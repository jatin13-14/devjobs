"""Synthetic route audit identities, only called after the owned runner's guards."""

from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.applications.models import Application
from apps.candidates.models import CandidateProfile
from apps.companies.models import CompanyMembership
from apps.companies.services import create_company
from apps.jobs.models import Job
from apps.recruiters.models import RecruiterProfile


def route_fixtures(run):
    accounts = {}
    profiles = {}
    for role in ("candidate", "owner", "admin", "member", "outsider", "platform"):
        email = f"route-{role}-{run}@example.test"
        user = (
            User.objects.create_superuser(email)
            if role == "platform"
            else User.objects.create_user(
                email, role="candidate" if role == "candidate" else "recruiter"
            )
        )
        profiles[role] = (
            CandidateProfile.objects.create(user=user, full_name="Route candidate")
            if role == "candidate"
            else RecruiterProfile.objects.create(user=user, name=f"Route {role}")
            if role != "platform"
            else None
        )
        refresh = RefreshToken.for_user(user)
        accounts[role] = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": str(user.pk),
                "role": user.role,
                "is_platform_admin": role == "platform",
            },
        }
    company = create_company(recruiter=profiles["owner"], name="Route audit company")
    for role in ("admin", "member"):
        CompanyMembership.objects.create(
            company=company, recruiter=profiles[role], role=role.upper(), status="ACTIVE"
        )
    job = Job.objects.create(
        company=company,
        creator=profiles["owner"].user,
        title="Route audit engineer",
        description="Synthetic route audit",
        employment_type="FULL_TIME",
        workplace_type="REMOTE",
        experience_level="MID",
        status="PUBLISHED",
        published_at=timezone.now(),
    )
    application = Application.objects.create(candidate=profiles["candidate"], job=job)
    return {
        "accounts": accounts,
        "company": str(company.pk),
        "job": str(job.pk),
        "application": str(application.pk),
    }
