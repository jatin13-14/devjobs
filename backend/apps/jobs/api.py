from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.candidates.models import Skill
from apps.companies.models import Company, CompanyMembership
from apps.companies.services import authorize_company_operation
from apps.recruiters.models import RecruiterProfile

from .models import Job


class JobPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class RejectUnknownFieldsMixin:
    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            writable = {name for name, field in self.fields.items() if not field.read_only}
            unknown = set(data.keys()) - writable
            if unknown:
                raise serializers.ValidationError(
                    {key: ["Unknown field."] for key in sorted(unknown)}
                )
        return super().to_internal_value(data)


class SkillNamesField(serializers.ListField):
    def to_representation(self, data):
        if hasattr(data, "all"):
            data = data.all()
        return super().to_representation(data)


class JobSerializer(RejectUnknownFieldsMixin, serializers.ModelSerializer):
    company_id = serializers.UUIDField(write_only=True, required=False)
    company = serializers.SerializerMethodField()
    skills = SkillNamesField(child=serializers.CharField(max_length=80), required=False)

    class Meta:
        model = Job
        fields = (
            "id",
            "company",
            "company_id",
            "title",
            "description",
            "employment_type",
            "workplace_type",
            "location",
            "country",
            "experience_level",
            "skills",
            "salary_min",
            "salary_max",
            "salary_currency",
            "application_deadline",
            "status",
            "published_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "company", "status", "published_at", "created_at", "updated_at")

    def get_company(self, obj):
        return {"id": str(obj.company_id), "name": obj.company.name}

    def validate_skills(self, values):
        names = [" ".join(value.split()).lower() for value in values]
        if any(not name for name in names) or len(set(names)) != len(names):
            raise serializers.ValidationError("Skills must be nonblank and unique.")
        return names

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and "company_id" in attrs:
            raise serializers.ValidationError(
                {"company_id": "A job cannot be moved to another company."}
            )
        values = {key: value for key, value in attrs.items() if key not in ("skills", "company_id")}
        candidate = self.instance or Job(creator=self.context["request"].user, **values)
        if self.instance:
            for key, value in values.items():
                setattr(candidate, key, value)
        try:
            candidate.full_clean(exclude=("company", "creator", "skills"))
        except DjangoValidationError as error:
            raise serializers.ValidationError(
                getattr(error, "message_dict", {"detail": error.messages})
            ) from error
        return attrs

    def create(self, validated_data):
        names = validated_data.pop("skills", [])
        company_id = validated_data.pop("company_id")
        company = get_object_or_404(Company, pk=company_id)
        job = Job.objects.create(
            company=company, creator=self.context["request"].user, **validated_data
        )
        if names:
            skills = [Skill.objects.get_or_create(name=name)[0] for name in names]
            job.skills.set(skills)
        return job

    def update(self, instance, validated_data):
        names = validated_data.pop("skills", None)
        validated_data.pop("company_id", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if names is not None:
            skills = [Skill.objects.get_or_create(name=name)[0] for name in names]
            instance.skills.set(skills)
        return instance


def _actor(request):
    if request.user.role != User.Role.RECRUITER:
        raise DRFPermissionDenied("Recruiter account required.")
    try:
        profile = RecruiterProfile.objects.get(user=request.user)
    except RecruiterProfile.DoesNotExist as error:
        raise DRFPermissionDenied("Recruiter profile required.") from error
    return profile


def _authorize(request, company_id):
    try:
        return authorize_company_operation(
            recruiter=_actor(request),
            company_id=company_id,
            allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN],
        )
    except PermissionDenied as error:
        raise DRFPermissionDenied(str(error)) from error


def _public_jobs(queryset):
    return queryset.filter(status=Job.Status.PUBLISHED, is_hidden=False, company__is_suspended=False).filter(
        Q(application_deadline__isnull=True) | Q(application_deadline__gte=timezone.localdate())
    )


class JobListBase(ListAPIView):
    serializer_class = JobSerializer
    pagination_class = JobPagination

    def filter_queryset(self, queryset):
        params = self.request.query_params
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
        fields = {
            "country": "country__iexact",
            "location": "location__icontains",
            "workplace_type": "workplace_type",
            "employment_type": "employment_type",
            "experience_level": "experience_level",
            "company": "company_id",
        }
        for param, field in fields.items():
            value = params.get(param)
            if value:
                queryset = queryset.filter(**{field: value})
        skill = params.get("skill")
        if skill:
            queryset = queryset.filter(skills__name__iexact=skill.strip()).distinct()
        return (
            queryset.select_related("company")
            .prefetch_related("skills")
            .order_by("-published_at", "-created_at", "id")
        )


class JobCollectionView(JobListBase):
    def get_queryset(self):
        return _public_jobs(Job.objects.all())

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            raise DRFPermissionDenied("Authentication required.")
        serializer = JobSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        company_id = serializer.validated_data["company_id"]
        get_object_or_404(Company.objects.select_for_update(), pk=company_id)
        _authorize(request, company_id)
        job = serializer.save()
        return Response(
            JobSerializer(job, context={"request": request}).data, status=status.HTTP_201_CREATED
        )


class JobDetailView(APIView):
    def get_permissions(self):
        return (IsAuthenticated(),) if self.request.method == "PATCH" else ()

    def get(self, request, job_id):
        job = get_object_or_404(
            _public_jobs(Job.objects.select_related("company").prefetch_related("skills")),
            pk=job_id,
        )
        return Response(JobSerializer(job).data)

    @transaction.atomic
    def patch(self, request, job_id):
        job = get_object_or_404(
            Job.objects.select_related("company").prefetch_related("skills"), pk=job_id
        )
        Company.objects.select_for_update().get(pk=job.company_id)
        _authorize(request, job.company_id)
        job = Job.objects.get(pk=job.pk)
        if job.is_hidden:
            raise DRFPermissionDenied("Job is held for moderation.")
        serializer = JobSerializer(
            job, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        return Response(JobSerializer(serializer.save()).data)


class JobTransitionView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def post(self, request, job_id):
        job = get_object_or_404(Job.objects.select_related("company"), pk=job_id)
        Company.objects.select_for_update().get(pk=job.company_id)
        _authorize(request, job.company_id)
        job = Job.objects.get(pk=job.pk)
        if job.is_hidden:
            raise DRFPermissionDenied("Job is held for moderation.")
        if request.path.endswith("/publish/"):
            if job.status == Job.Status.CLOSED:
                raise serializers.ValidationError({"status": "A closed job cannot be republished."})
            job.status = Job.Status.PUBLISHED
            if job.published_at is None:
                job.published_at = timezone.now()
            job.save(update_fields=("status", "published_at", "updated_at"))
        else:
            job.status = Job.Status.CLOSED
            job.save(update_fields=("status", "updated_at"))
        return Response(JobSerializer(job).data)


class CompanyJobsView(JobListBase):
    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def get_queryset(self):
        company = get_object_or_404(Company, pk=self.kwargs["company_id"])
        queryset = Job.objects.filter(company=company)
        user = self.request.user
        if not user.is_authenticated or user.role != User.Role.RECRUITER:
            return _public_jobs(queryset)
        membership = CompanyMembership.objects.filter(
            recruiter__user=user, company=company, status=CompanyMembership.Status.ACTIVE
        ).first()
        if user.is_active and not company.is_suspended and membership and membership.role in (
            CompanyMembership.Role.OWNER,
            CompanyMembership.Role.ADMIN,
        ):
            return queryset
        return _public_jobs(queryset)
