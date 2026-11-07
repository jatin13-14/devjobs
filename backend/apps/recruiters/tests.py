import uuid

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.companies.models import CompanyMembership
from apps.companies.services import create_company

from .models import RecruiterProfile


class RecruiterModelTests(TestCase):
    def test_profile_relationship_uuid_and_optional_work_email(self):
        user = User.objects.create_user(
            "recruiter@example.test", password="Test-pass-123", role=User.Role.RECRUITER
        )
        profile = RecruiterProfile.objects.create(user=user, name="Test Recruiter")
        self.assertIsInstance(profile.pk, uuid.UUID)
        self.assertEqual(profile.user, user)
        self.assertEqual(profile.work_email, "")
        with self.assertRaises(ValidationError):
            RecruiterProfile.objects.create(user=user, name="Duplicate")

    def test_profile_rejects_non_recruiter_user(self):
        user = User.objects.create_user("candidate@example.test", password="Test-pass-123")
        with self.assertRaises(ValidationError):
            RecruiterProfile.objects.create(user=user, name="Not a recruiter")


class RecruiterCompaniesApiTests(APITestCase):
    def make_recruiter(self, name):
        local_part = name.lower().replace(" ", "-")
        user = User.objects.create_user(f"{local_part}@example.test", password="Synthetic-pass-123!", role=User.Role.RECRUITER)
        RecruiterProfile.objects.create(user=user, name=name)
        return user

    def test_lists_only_callers_active_memberships_without_private_fields(self):
        user = self.make_recruiter("Riley")
        suspended_company = create_company(recruiter=self.make_recruiter("Owner A").recruiter_profile, name="Synthetic A")
        active_company = create_company(recruiter=self.make_recruiter("Owner B").recruiter_profile, name="Synthetic B")
        CompanyMembership.objects.create(company=suspended_company, recruiter=user.recruiter_profile, role="ADMIN", status="SUSPENDED")
        active = CompanyMembership.objects.create(company=active_company, recruiter=user.recruiter_profile, role="MEMBER", status="ACTIVE")
        self.client.force_authenticate(user)
        response = self.client.get("/api/v1/recruiters/me/companies/?user_id=ignored")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [{"id": str(active_company.pk), "name": "Synthetic B", "membership_id": str(active.pk), "role": "MEMBER"}])
        self.assertNotIn("email", response.data[0])
        self.assertNotIn("logo", response.data[0])

    def test_empty_list_and_access_denials(self):
        recruiter = self.make_recruiter("Empty")
        self.client.force_authenticate(recruiter)
        self.assertEqual(self.client.get("/api/v1/recruiters/me/companies/").data, [])
        candidate = User.objects.create_user("candidate@example.test", password="Synthetic-pass-123!")
        self.client.force_authenticate(candidate)
        self.assertEqual(self.client.get("/api/v1/recruiters/me/companies/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/v1/recruiters/me/companies/").status_code, 401)
