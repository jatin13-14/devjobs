"""Candidate-only saved jobs. Only currently public jobs appear in saved lists."""

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile

from .api import JobSerializer, _public_jobs
from .models import Job, SavedJob


def candidate_for(request):
    if request.user.role != User.Role.CANDIDATE or not request.user.is_active:
        raise PermissionDenied("An active candidate account is required.")
    return get_object_or_404(CandidateProfile, user=request.user)


class SavedJobSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)

    class Meta:
        model = SavedJob
        fields = ("job", "saved_at")


class SavedJobPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class CandidateSavedJobsView(ListAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = SavedJobSerializer
    pagination_class = SavedJobPagination

    def get_queryset(self):
        candidate = candidate_for(self.request)
        visible_jobs = _public_jobs(Job.objects.all())
        return (
            SavedJob.objects.filter(candidate=candidate, job__in=visible_jobs)
            .select_related("job__company")
            .prefetch_related("job__skills")
            .order_by("-saved_at", "-id")
        )


class CandidateSavedJobStatusesView(APIView):
    """One bounded query checks the current candidate's job-card bookmarks."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        candidate = candidate_for(request)
        if set(request.query_params) - {"job_id"}:
            raise serializers.ValidationError({"detail": "Unsupported query parameter."})
        values = request.query_params.getlist("job_id")
        if len(values) > 100:
            raise serializers.ValidationError({"job_id": ["At most 100 job IDs are supported."]})
        field = serializers.UUIDField()
        try:
            ids = [field.run_validation(value) for value in values]
        except serializers.ValidationError as error:
            raise serializers.ValidationError({"job_id": error.detail}) from error
        saved_ids = SavedJob.objects.filter(
            candidate=candidate, job_id__in=ids
        ).values_list("job_id", flat=True)
        return Response({"saved_job_ids": sorted(str(value) for value in saved_ids)})


class CandidateSavedJobDetailView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, job_id):
        candidate = candidate_for(request)
        return Response({"saved": SavedJob.objects.filter(candidate=candidate, job_id=job_id).exists()})

    def put(self, request, job_id):
        candidate = candidate_for(request)
        job = get_object_or_404(_public_jobs(Job.objects.all()), pk=job_id)
        try:
            with transaction.atomic():
                saved, created = SavedJob.objects.get_or_create(candidate=candidate, job=job)
        except IntegrityError:
            # Two same-candidate concurrent requests can race on the unique index.
            saved = SavedJob.objects.get(candidate=candidate, job=job)
            created = False
        return Response(
            SavedJobSerializer(saved).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, job_id):
        candidate = candidate_for(request)
        SavedJob.objects.filter(candidate=candidate, job_id=job_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
