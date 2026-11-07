from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
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
from apps.candidates.models import CandidateProfile
from apps.companies.models import Company, CompanyMembership
from apps.companies.services import authorize_company_operation
from apps.jobs.models import Job
from apps.recruiters.models import RecruiterProfile

from .models import Application, ApplicationStatusHistory


class ApplicationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class ApplicationSerializer(serializers.ModelSerializer):
    resume_available = serializers.SerializerMethodField()
    job = serializers.SerializerMethodField()
    candidate = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = (
            "id",
            "job",
            "candidate",
            "status",
            "cover_letter",
            "applied_at",
            "updated_at",
            "withdrawn_at",
            "resume_available",
        )
        read_only_fields = fields

    def get_resume_available(self, obj):
        return (obj.status != Application.Status.WITHDRAWN
                and obj.candidate.user.is_active
                and hasattr(obj.candidate, "resume"))

    def get_job(self, obj):
        return {"id": str(obj.job_id), "title": obj.job.title, "company": obj.job.company.name}

    def get_candidate(self, obj):
        profile = obj.candidate
        return {
            "full_name": profile.full_name,
            "professional_headline": profile.professional_headline,
            "country": profile.country,
            "city": profile.city,
            "years_of_experience": profile.years_of_experience,
            "current_designation": profile.current_designation,
            "skills": list(
                profile.candidate_skills.select_related("skill")
                .order_by("skill__name")
                .values_list("skill__name", flat=True)
            ),
        }


class CandidateApplicationInput(serializers.Serializer):
    cover_letter = serializers.CharField(
        required=False, allow_blank=True, max_length=5000, trim_whitespace=False
    )

    def to_internal_value(self, data):
        unknown = set(data) - {"cover_letter"} if hasattr(data, "keys") else set()
        if unknown:
            raise serializers.ValidationError({key: ["Unknown field."] for key in unknown})
        return super().to_internal_value(data)


def _candidate(user):
    if not user.is_authenticated or user.role != User.Role.CANDIDATE:
        raise DRFPermissionDenied("Candidate account required.")
    try:
        return CandidateProfile.objects.get(user=user)
    except CandidateProfile.DoesNotExist as error:
        raise DRFPermissionDenied("Candidate profile required.") from error


def _recruiter(user):
    if not user.is_authenticated or user.role != User.Role.RECRUITER:
        raise DRFPermissionDenied("Recruiter account required.")
    try:
        return RecruiterProfile.objects.get(user=user)
    except RecruiterProfile.DoesNotExist as error:
        raise DRFPermissionDenied("Recruiter profile required.") from error


def _authorize_job(user, job):
    try:
        authorize_company_operation(
            recruiter=_recruiter(user),
            company_id=job.company_id,
            allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN],
        )
    except PermissionDenied as error:
        raise DRFPermissionDenied(str(error)) from error


def _job_application(job, application_id):
    return get_object_or_404(
        Application.objects.select_related("candidate", "job__company"), pk=application_id, job=job
    )


class CandidateApplicationsView(ListAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = ApplicationSerializer
    pagination_class = ApplicationPagination

    def get_queryset(self):
        candidate = _candidate(self.request.user)
        return Application.objects.filter(candidate=candidate).select_related(
            "job", "job__company", "candidate"
        )


class CandidateApplicationDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, application_id):
        candidate = _candidate(request.user)
        obj = get_object_or_404(
            Application.objects.select_related("job", "job__company", "candidate"),
            pk=application_id,
            candidate=candidate,
        )
        return Response(ApplicationSerializer(obj).data)

    @transaction.atomic
    def patch(self, request, application_id):
        candidate = _candidate(request.user)
        obj = get_object_or_404(
            Application.objects.select_for_update().select_related(
                "job", "job__company", "candidate"
            ),
            pk=application_id,
            candidate=candidate,
        )
        data = CandidateApplicationInput(data=request.data)
        data.is_valid(raise_exception=True)
        if data.validated_data:
            raise serializers.ValidationError("Applications cannot be edited after submission.")
        if obj.status not in (
            Application.Status.SUBMITTED,
            Application.Status.REVIEWING,
            Application.Status.SHORTLISTED,
        ):
            raise serializers.ValidationError(
                {"status": "This application can no longer be withdrawn."}
            )
        previous = obj.status
        obj.status = Application.Status.WITHDRAWN
        obj.withdrawn_at = timezone.now()
        obj.save(update_fields=("status", "withdrawn_at", "updated_at"))
        ApplicationStatusHistory.objects.create(
            application=obj, previous_status=previous, new_status=obj.status, actor=request.user
        )
        return Response(ApplicationSerializer(obj).data)


class JobApplicationsView(ListAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = ApplicationSerializer
    pagination_class = ApplicationPagination

    def get_queryset(self):
        job = get_object_or_404(Job.objects.select_related("company"), pk=self.kwargs["job_id"])
        _authorize_job(self.request.user, job)
        return (
            Application.objects.filter(job=job)
            .select_related("job", "job__company", "candidate")
            .prefetch_related("candidate__candidate_skills__skill")
        )

    def post(self, request, job_id):
        candidate = _candidate(request.user)
        data = CandidateApplicationInput(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                reference = get_object_or_404(Job, pk=job_id)
                company = Company.objects.select_for_update().get(pk=reference.company_id)
                job = Job.objects.select_for_update().get(pk=job_id)
                if job.status != Job.Status.PUBLISHED or job.is_hidden or company.is_suspended:
                    raise serializers.ValidationError(
                        {"job": "Applications are accepted only for published jobs."}
                    )
                if job.application_deadline and job.application_deadline < timezone.localdate():
                    raise serializers.ValidationError(
                        {"job": "The application deadline has passed."}
                    )
                application = Application.objects.create(
                    candidate=candidate,
                    job=job,
                    cover_letter=data.validated_data.get("cover_letter", ""),
                )
                ApplicationStatusHistory.objects.create(
                    application=application,
                    previous_status="",
                    new_status=application.status,
                    actor=request.user,
                )
        except IntegrityError as error:
            raise serializers.ValidationError(
                {"job": "You have already applied to this job."}
            ) from error
        return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)


class JobApplicationDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, job_id, application_id):
        job = get_object_or_404(Job.objects.select_related("company"), pk=job_id)
        _authorize_job(request.user, job)
        obj = _job_application(job, application_id)
        return Response(ApplicationSerializer(obj).data)


class RecruiterApplicationStatusInput(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            Application.Status.REVIEWING,
            Application.Status.SHORTLISTED,
            Application.Status.REJECTED,
        )
    )

    def to_internal_value(self, data):
        unknown = set(data) - {"status"} if hasattr(data, "keys") else set()
        if unknown:
            raise serializers.ValidationError({key: ["Unknown field."] for key in unknown})
        return super().to_internal_value(data)


class RecruiterApplicationStatusView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def patch(self, request, job_id, application_id):
        job = get_object_or_404(
            Job.objects.select_for_update().select_related("company"), pk=job_id
        )
        _authorize_job(request.user, job)
        obj = _job_application(job, application_id)
        obj = Application.objects.select_for_update().get(pk=obj.pk)
        data = RecruiterApplicationStatusInput(data=request.data)
        data.is_valid(raise_exception=True)
        target = data.validated_data["status"]
        transitions = {
            Application.Status.SUBMITTED: {
                Application.Status.REVIEWING,
                Application.Status.SHORTLISTED,
                Application.Status.REJECTED,
            },
            Application.Status.REVIEWING: {
                Application.Status.SHORTLISTED,
                Application.Status.REJECTED,
            },
            Application.Status.SHORTLISTED: {Application.Status.REJECTED},
        }
        if target not in transitions.get(obj.status, set()):
            raise serializers.ValidationError(
                {"status": f"Cannot transition from {obj.status} to {target}."}
            )
        previous = obj.status
        obj.status = target
        obj.save(update_fields=("status", "updated_at"))
        ApplicationStatusHistory.objects.create(
            application=obj, previous_status=previous, new_status=target, actor=request.user
        )
        obj = Application.objects.select_related("candidate", "job__company", "job").get(pk=obj.pk)
        return Response(ApplicationSerializer(obj).data)
