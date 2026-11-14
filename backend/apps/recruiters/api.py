from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.companies.models import CompanyMembership
from apps.recruiters.models import RecruiterProfile
from config.collection_pagination import collection_response


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
                recruiter=profile,
                status=CompanyMembership.Status.ACTIVE,
                company__is_suspended=False,
            )
            .select_related("company")
            .order_by("company__name", "company_id")
        )
        if request.query_params.get("pagination") == "page":
            filters = RecruiterCompanyFilters(
                data={
                    key: request.query_params[key]
                    for key in ("search", "company_id")
                    if key in request.query_params
                }
            )
            filters.is_valid(raise_exception=True)
            values = filters.validated_data
            if values.get("search"):
                memberships = memberships.filter(company__name__icontains=values["search"])
            if "company_id" in values:
                memberships = memberships.filter(company_id=values["company_id"])
        return collection_response(
            request,
            memberships,
            lambda items: [
                {
                    "id": str(item.company_id),
                    "name": item.company.name,
                    "membership_id": str(item.pk),
                    "role": item.role,
                }
                for item in items
            ],
        )


class RecruiterCompanyFilters(serializers.Serializer):
    search = serializers.CharField(
        required=False, allow_blank=True, max_length=200, trim_whitespace=True
    )
    company_id = serializers.UUIDField(required=False)
