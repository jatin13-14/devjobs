from django.db import DatabaseError
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.applications.api import _authorize_job, _job_application
from apps.applications.models import Application
from apps.jobs.models import Job

from .api import IsCandidate, RejectUnknownFieldsMixin
from .models import CandidateProfile, CandidateResume
from .resumes import download, metadata, remove_resume, replace_resume, validate_pdf


class ResumeInput(RejectUnknownFieldsMixin, serializers.Serializer):
    file = serializers.FileField()


class CandidateResumeView(APIView):
    permission_classes = (IsAuthenticated, IsCandidate)
    parser_classes = (MultiPartParser,)

    def get(self, request):
        candidate = get_object_or_404(CandidateProfile, user=request.user)
        resume = CandidateResume.objects.filter(candidate=candidate).first()
        return Response({"resume": metadata(resume) if resume else None})

    def put(self, request):
        candidate = get_object_or_404(CandidateProfile, user=request.user)
        serializer = ResumeInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        if len(request.FILES.getlist("file")) != 1:
            raise serializers.ValidationError({"file": "Upload exactly one PDF."})
        data = validate_pdf(serializer.validated_data["file"])
        try:
            resume = replace_resume(candidate, data)
        except (OSError, DatabaseError):
            error = APIException("Resume storage temporarily unavailable.")
            error.status_code = 503
            raise error from None
        return Response({"resume": metadata(resume)})

    def delete(self, request):
        candidate = get_object_or_404(CandidateProfile, user=request.user)
        try:
            remove_resume(candidate)
        except DatabaseError:
            error = APIException("Resume storage temporarily unavailable.")
            error.status_code = 503
            raise error from None
        return Response(status=status.HTTP_204_NO_CONTENT)


class CandidateResumeDownloadView(APIView):
    permission_classes = (IsAuthenticated, IsCandidate)

    def get(self, request):
        return download(get_object_or_404(CandidateProfile, user=request.user))


class ApplicantResumeDownloadView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, job_id, application_id):
        job = get_object_or_404(Job.objects.select_related("company"), pk=job_id)
        _authorize_job(request.user, job)
        application = _job_application(job, application_id)
        if (
            application.status == Application.Status.WITHDRAWN
            or not application.candidate.user.is_active
        ):
            raise NotFound("Resume unavailable.")
        return download(application.candidate)
