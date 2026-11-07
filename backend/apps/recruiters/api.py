from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.companies.models import CompanyMembership
from apps.recruiters.models import RecruiterProfile


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


class RecruiterProfileSerializer(RejectUnknownFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = RecruiterProfile
        fields = ("id", "name", "designation", "work_email", "phone", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class RecruiterProfileView(APIView):
    permission_classes = (IsAuthenticated, IsRecruiter)

    def get(self, request):
        profile = get_object_or_404(RecruiterProfile, user=request.user)
        return Response(RecruiterProfileSerializer(profile).data)

    def patch(self, request):
        profile = get_object_or_404(RecruiterProfile, user=request.user)
        serializer = RecruiterProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class RecruiterCompaniesView(APIView):
    permission_classes = (IsAuthenticated, IsRecruiter)

    def get(self, request):
        profile = get_object_or_404(RecruiterProfile, user=request.user)
        memberships = (
            CompanyMembership.objects.filter(
                recruiter=profile, status=CompanyMembership.Status.ACTIVE, company__is_suspended=False
            )
            .select_related("company")
            .order_by("company__name", "company_id")
        )
        return Response([
            {
                "id": str(item.company_id),
                "name": item.company.name,
                "membership_id": str(item.pk),
                "role": item.role,
            }
            for item in memberships
        ])
