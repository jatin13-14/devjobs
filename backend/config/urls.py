from django.contrib import admin
from django.urls import path
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.serializers import (
    CandidateRegistrationSerializer,
    EmailTokenObtainPairSerializer,
    RecruiterRegistrationSerializer,
)
from apps.applications.api import (
    CandidateApplicationDetailView,
    CandidateApplicationsView,
    JobApplicationDetailView,
    JobApplicationsView,
    RecruiterApplicationStatusView,
)
from apps.candidates.api import CandidateProfileView, CandidateSkillDetailView, CandidateSkillsView
from apps.candidates.resume_api import (
    ApplicantResumeDownloadView,
    CandidateResumeDownloadView,
    CandidateResumeView,
)
from apps.companies.api import (
    CompanyCollectionView,
    CompanyDetailView,
    CompanyMemberDetailView,
    CompanyMembersView,
)
from apps.jobs.api import CompanyJobsView, JobCollectionView, JobDetailView, JobTransitionView
from apps.moderation.api import CollectionView, DetailView, HistoryView, OverviewView
from apps.recruiters.api import RecruiterCompaniesView, RecruiterProfileView
from config.health import ReadinessView


class JwtTokenRateThrottle(AnonRateThrottle):
    scope = "jwt_token"


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    throttle_classes = (JwtTokenRateThrottle,)


class CandidateRegistrationView(generics.CreateAPIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    serializer_class = CandidateRegistrationSerializer


class RecruiterRegistrationView(generics.CreateAPIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    serializer_class = RecruiterRegistrationSerializer


class HealthView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request):
        return Response({"status": "ok", "service": "devjobs-api"})


urlpatterns = [
    path("api/v1/candidates/me/resume/", CandidateResumeView.as_view()),
    path("api/v1/candidates/me/resume/download/", CandidateResumeDownloadView.as_view()),
    path("api/v1/jobs/<uuid:job_id>/applications/<uuid:application_id>/resume/", ApplicantResumeDownloadView.as_view()),
    path("admin/", admin.site.urls),
    path("api/v1/ready/", ReadinessView.as_view(), name="readiness"),
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path(
        "api/v1/auth/candidate/register/",
        CandidateRegistrationView.as_view(),
        name="candidate-register",
    ),
    path(
        "api/v1/auth/recruiter/register/",
        RecruiterRegistrationView.as_view(),
        name="recruiter-register",
    ),
    path("api/v1/auth/login/", EmailTokenObtainPairView.as_view(), name="login"),
    path("api/v1/auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/v1/candidates/me/profile/", CandidateProfileView.as_view(), name="candidate-profile"),
    path("api/v1/candidates/me/skills/", CandidateSkillsView.as_view(), name="candidate-skills"),
    path(
        "api/v1/candidates/me/skills/<uuid:skill_id>/",
        CandidateSkillDetailView.as_view(),
        name="candidate-skill-detail",
    ),
    path("api/v1/recruiters/me/profile/", RecruiterProfileView.as_view(), name="recruiter-profile"),
    path("api/v1/recruiters/me/companies/", RecruiterCompaniesView.as_view(), name="recruiter-companies"),
    path("api/v1/companies/", CompanyCollectionView.as_view(), name="company-collection"),
    path("api/v1/companies/<uuid:company_id>/", CompanyDetailView.as_view(), name="company-detail"),
    path(
        "api/v1/companies/<uuid:company_id>/members/",
        CompanyMembersView.as_view(),
        name="company-members",
    ),
    path(
        "api/v1/companies/<uuid:company_id>/members/<uuid:membership_id>/",
        CompanyMemberDetailView.as_view(),
        name="company-member-detail",
    ),
    path("api/v1/jobs/", JobCollectionView.as_view(), name="job-collection"),
    path("api/v1/jobs/<uuid:job_id>/", JobDetailView.as_view(), name="job-detail"),
    path("api/v1/jobs/<uuid:job_id>/publish/", JobTransitionView.as_view(), name="job-publish"),
    path("api/v1/jobs/<uuid:job_id>/close/", JobTransitionView.as_view(), name="job-close"),
    path(
        "api/v1/jobs/<uuid:job_id>/applications/",
        JobApplicationsView.as_view(),
        name="job-applications",
    ),
    path(
        "api/v1/jobs/<uuid:job_id>/applications/<uuid:application_id>/",
        JobApplicationDetailView.as_view(),
        name="job-application-detail",
    ),
    path(
        "api/v1/jobs/<uuid:job_id>/applications/<uuid:application_id>/status/",
        RecruiterApplicationStatusView.as_view(),
        name="job-application-status",
    ),
    path(
        "api/v1/candidates/me/applications/",
        CandidateApplicationsView.as_view(),
        name="candidate-applications",
    ),
    path(
        "api/v1/candidates/me/applications/<uuid:application_id>/",
        CandidateApplicationDetailView.as_view(),
        name="candidate-application-detail",
    ),
    path(
        "api/v1/companies/<uuid:company_id>/jobs/", CompanyJobsView.as_view(), name="company-jobs"
    ),
]

urlpatterns += [path("api/v1/admin/overview/", OverviewView.as_view()), path("api/v1/admin/history/", HistoryView.as_view())]
for kind in ("companies", "recruiters", "candidates", "jobs"):
    urlpatterns += [path(f"api/v1/admin/{kind}/", CollectionView.as_view(), {"kind": kind}), path(f"api/v1/admin/{kind}/<uuid:target_id>/", DetailView.as_view(), {"kind": kind})]
