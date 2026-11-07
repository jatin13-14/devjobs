from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.recruiters.models import RecruiterProfile

from .models import Company, CompanyMembership
from .services import (
    InvalidMembershipTransition,
    add_membership,
    authorize_company_operation,
    create_company,
    remove_membership,
    set_membership_role,
    set_membership_status,
    transfer_ownership,
)


class IsRecruiter(BasePermission):
    message = "Recruiter account required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.RECRUITER)


class RejectUnknownFieldsMixin:
    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            writable = {name for name, field in self.fields.items() if not field.read_only}
            unknown = set(data.keys()) - writable
            if unknown:
                raise serializers.ValidationError({key: ["Unknown field."] for key in sorted(unknown)})
        return super().to_internal_value(data)


class CompanySerializer(RejectUnknownFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = (
            "id", "name", "website", "description", "industry", "company_size",
            "headquarters_country", "headquarters_city", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        company = self.instance or Company(**attrs)
        for key, value in attrs.items():
            setattr(company, key, value)
        try:
            company.full_clean()
        except DjangoValidationError as error:
            raise serializers.ValidationError(getattr(error, "message_dict", {"detail": error.messages})) from error
        return attrs


class MembershipSerializer(serializers.ModelSerializer):
    recruiter_id = serializers.UUIDField(source="recruiter.user_id", read_only=True)
    recruiter_name = serializers.CharField(source="recruiter.name", read_only=True)

    class Meta:
        model = CompanyMembership
        fields = ("id", "recruiter_id", "recruiter_name", "role", "status", "created_at", "updated_at")
        read_only_fields = fields


class MembershipCreateSerializer(RejectUnknownFieldsMixin, serializers.Serializer):
    recruiter_id = serializers.UUIDField()
    role = serializers.ChoiceField(choices=(CompanyMembership.Role.ADMIN, CompanyMembership.Role.MEMBER), default=CompanyMembership.Role.MEMBER)
    status = serializers.ChoiceField(choices=CompanyMembership.Status.choices, default=CompanyMembership.Status.INVITED)


class MembershipUpdateSerializer(RejectUnknownFieldsMixin, serializers.Serializer):
    role = serializers.ChoiceField(choices=CompanyMembership.Role.choices, required=False)
    status = serializers.ChoiceField(choices=CompanyMembership.Status.choices, required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError({"detail": "At least one field is required."})
        return attrs


def _actor_profile(request):
    return get_object_or_404(RecruiterProfile, user=request.user)


def _service_error(error):
    if isinstance(error, PermissionDenied):
        from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
        raise DRFPermissionDenied(str(error)) from error
    if isinstance(error, InvalidMembershipTransition):
        raise serializers.ValidationError({"detail": error.messages[0]}) from error
    raise error


class CompanyCollectionView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if request.user.role != User.Role.RECRUITER:
            from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
            raise DRFPermissionDenied("Recruiter account required.")
        serializer = CompanySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = create_company(recruiter=_actor_profile(request), **serializer.validated_data)
        membership = company.memberships.select_related("recruiter").get(role=CompanyMembership.Role.OWNER)
        return Response({"company": CompanySerializer(company).data, "membership": MembershipSerializer(membership).data}, status=status.HTTP_201_CREATED)


class CompanyDetailView(APIView):
    def get_permissions(self):
        return (IsAuthenticated(),) if self.request.method == "PATCH" else ()

    def get(self, request, company_id):
        company = get_object_or_404(Company, pk=company_id)
        return Response(CompanySerializer(company).data)

    @transaction.atomic
    def patch(self, request, company_id):
        if request.user.role != User.Role.RECRUITER:
            from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
            raise DRFPermissionDenied("Recruiter account required.")
        actor = _actor_profile(request)
        company = get_object_or_404(Company.objects.select_for_update(), pk=company_id)
        try:
            authorize_company_operation(recruiter=actor, company_id=company_id,
                                        allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN])
        except PermissionDenied as error:
            _service_error(error)
        serializer = CompanySerializer(company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CompanyMembersView(APIView):
    permission_classes = (IsAuthenticated, IsRecruiter)

    def _authorize(self, request, company_id):
        try:
            authorize_company_operation(recruiter=_actor_profile(request), company_id=company_id,
                                        allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN])
        except PermissionDenied as error:
            _service_error(error)

    def get(self, request, company_id):
        self._authorize(request, company_id)
        memberships = CompanyMembership.objects.filter(company_id=company_id).select_related("recruiter").order_by("created_at", "id")
        return Response(MembershipSerializer(memberships, many=True).data)

    def post(self, request, company_id):
        self._authorize(request, company_id)
        serializer = MembershipCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            recruiter = RecruiterProfile.objects.select_related("user").get(user_id=serializer.validated_data["recruiter_id"])
        except RecruiterProfile.DoesNotExist as error:
            raise serializers.ValidationError({"recruiter_id": "An existing recruiter account and profile are required."}) from error
        try:
            membership = add_membership(actor=_actor_profile(request), company_id=company_id, recruiter=recruiter,
                                        role=serializer.validated_data["role"], status=serializer.validated_data["status"])
        except (PermissionDenied, InvalidMembershipTransition) as error:
            _service_error(error)
        except IntegrityError as error:
            raise serializers.ValidationError({"detail": "This recruiter already has a company membership."}) from error
        return Response(MembershipSerializer(membership).data, status=status.HTTP_201_CREATED)


class CompanyMemberDetailView(APIView):
    permission_classes = (IsAuthenticated, IsRecruiter)

    @transaction.atomic
    def patch(self, request, company_id, membership_id):
        membership = get_object_or_404(CompanyMembership, pk=membership_id, company_id=company_id)
        actor = _actor_profile(request)
        serializer = MembershipUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        changes = serializer.validated_data
        try:
            if changes.get("role") == CompanyMembership.Role.OWNER:
                if "status" in changes and changes["status"] != CompanyMembership.Status.ACTIVE:
                    raise serializers.ValidationError({"status": "An owner must remain active; transfer first."})
                transfer_ownership(actor=actor, company_id=company_id, new_owner=membership.recruiter)
            else:
                if "role" in changes:
                    membership = set_membership_role(actor=actor, membership_id=membership.pk, role=changes["role"])
                if "status" in changes:
                    membership = set_membership_status(actor=actor, membership_id=membership.pk, status=changes["status"])
        except (PermissionDenied, InvalidMembershipTransition) as error:
            _service_error(error)
        membership.refresh_from_db()
        return Response(MembershipSerializer(membership).data)

    def delete(self, request, company_id, membership_id):
        membership = get_object_or_404(CompanyMembership, pk=membership_id, company_id=company_id)
        try:
            remove_membership(actor=_actor_profile(request), membership_id=membership.pk)
        except (PermissionDenied, InvalidMembershipTransition) as error:
            _service_error(error)
        return Response(status=status.HTTP_204_NO_CONTENT)
