from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.companies.models import CompanyMembership
from apps.companies.services import create_company
from apps.recruiters.models import RecruiterProfile


class JobApiTests(APITestCase):
    def make_user(self, name, role=User.Role.RECRUITER):
        user = User.objects.create_user(
            f"{name}@example.test", password="Synthetic-pass-123!", role=role
        )
        if role == User.Role.RECRUITER:
            RecruiterProfile.objects.create(user=user, name=f"Synthetic {name}")
        return user

    def setUp(self):
        self.owner = self.make_user("jobs-owner")
        self.company = create_company(
            recruiter=self.owner.recruiter_profile, name="Synthetic Jobs Co"
        )
        self.admin = self.make_user("jobs-admin")
        self.member = self.make_user("jobs-member")
        self.other = self.make_user("jobs-other")
        for user, role in ((self.admin, "ADMIN"), (self.member, "MEMBER")):
            CompanyMembership.objects.create(
                company=self.company, recruiter=user.recruiter_profile, role=role, status="ACTIVE"
            )
        self.payload = {
            "company_id": str(self.company.pk),
            "title": "Backend Engineer",
            "description": "Build reliable APIs with Python.",
            "employment_type": "FULL_TIME",
            "workplace_type": "REMOTE",
            "experience_level": "MID",
            "country": "IN",
            "location": "Remote",
            "skills": ["Python", "Django"],
        }

    def create_job(self, user=None, payload=None):
        self.client.force_authenticate(user or self.owner)
        return self.client.post("/api/v1/jobs/", payload or self.payload, format="json")

    def test_create_requires_authorized_active_recruiter_membership(self):
        self.assertEqual(self.create_job().status_code, 201)
        self.assertEqual(self.create_job(self.admin).status_code, 201)
        self.assertEqual(self.create_job(self.member).status_code, 403)
        self.assertEqual(self.create_job(self.other).status_code, 403)
        self.assertEqual(
            self.create_job(self.make_user("candidate-job", User.Role.CANDIDATE)).status_code, 403
        )

    def test_anonymous_and_candidates_cannot_write_and_owner_fields_are_rejected(self):
        self.client.force_authenticate(None)
        self.assertIn(
            self.client.post("/api/v1/jobs/", self.payload, format="json").status_code, (401, 403)
        )
        self.client.force_authenticate(self.make_user("candidate-write", User.Role.CANDIDATE))
        self.assertEqual(
            self.client.post("/api/v1/jobs/", self.payload, format="json").status_code, 403
        )
        bad = {**self.payload, "creator": str(self.owner.pk)}
        self.assertEqual(self.create_job(payload=bad).status_code, 400)

    def test_validation_country_currency_salary_and_choices(self):
        invalids = [
            {"country": "ZZ"},
            {"salary_min": "10", "salary_currency": "ZZZ"},
            {"salary_min": "200", "salary_max": "100", "salary_currency": "USD"},
            {"employment_type": "PERMANENT"},
            {"workplace_type": "ANYWHERE"},
        ]
        for changes in invalids:
            with self.subTest(changes=changes):
                response = self.create_job(payload={**self.payload, **changes})
                self.assertEqual(response.status_code, 400)

    def test_owner_admin_can_edit_publish_and_close_but_member_cannot(self):
        created = self.create_job()
        job_id = created.data["id"]
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/jobs/{job_id}/").status_code, 404)
        self.client.force_authenticate(self.member)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/jobs/{job_id}/", {"title": "Changed"}, format="json"
            ).status_code,
            403,
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/jobs/{job_id}/", {"title": "Senior Backend Engineer"}, format="json"
            ).status_code,
            200,
        )
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/publish/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/close/").status_code, 200)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{job_id}/publish/").status_code, 400)

    def test_public_visibility_search_filters_and_pagination(self):
        first = self.create_job().data["id"]
        self.client.force_authenticate(self.owner)
        second_payload = {
            **self.payload,
            "title": "Frontend Developer",
            "country": "US",
            "workplace_type": "HYBRID",
            "location": "San Francisco",
        }
        second = self.client.post("/api/v1/jobs/", second_payload, format="json").data["id"]
        self.client.post(f"/api/v1/jobs/{first}/publish/")
        self.client.post(f"/api/v1/jobs/{second}/publish/")
        self.client.force_authenticate(None)
        response = self.client.get(
            "/api/v1/jobs/?search=backend&country=IN&workplace_type=REMOTE&skill=python&page_size=1"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], first)
        self.assertIsNone(response.data["next"])
        self.assertNotIn("creator", response.data["results"][0])
        self.assertEqual(self.client.get(f"/api/v1/jobs/{first}/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/jobs/{second}/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/jobs/?location=San").data["count"], 1)
        self.assertEqual(self.client.get("/api/v1/jobs/?country=US").data["count"], 1)
        self.assertEqual(self.client.get("/api/v1/jobs/?workplace_type=HYBRID").data["count"], 1)
        self.assertEqual(self.client.get("/api/v1/jobs/?search=Python").data["count"], 2)
        self.assertEqual(
            self.client.get("/api/v1/jobs/?employment_type=FULL_TIME").data["count"], 2
        )
        self.assertEqual(self.client.get("/api/v1/jobs/?experience_level=MID").data["count"], 2)
        self.assertEqual(
            self.client.get(f"/api/v1/jobs/?company={self.company.pk}").data["count"], 2
        )
        page = self.client.get("/api/v1/jobs/?page_size=1")
        self.assertEqual(page.data["count"], 2)
        self.assertIsNotNone(page.data["next"])
        self.client.force_authenticate(self.owner)
        self.client.post(f"/api/v1/jobs/{first}/close/")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/jobs/{first}/").status_code, 404)

    def test_registered_recruiter_completes_posting_and_applicant_journey(self):
        client = self.client_class()
        registered = client.post(
            "/api/v1/auth/recruiter/register/",
            {
                "email": "journey-recruiter@example.test",
                "password": "Synthetic-pass-123!",
                "name": "Synthetic Journey Recruiter",
            },
            format="json",
        )
        self.assertEqual(registered.status_code, 201)
        login = client.post(
            "/api/v1/auth/login/",
            {"email": "journey-recruiter@example.test", "password": "Synthetic-pass-123!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        self.assertEqual(client.get("/api/v1/recruiters/me/profile/").status_code, 200)
        company = client.post(
            "/api/v1/companies/", {"name": "Synthetic Journey Company"}, format="json"
        )
        self.assertEqual(company.status_code, 201)
        company_id = company.data["company"]["id"]
        memberships = client.get("/api/v1/recruiters/me/companies/")
        self.assertEqual(memberships.status_code, 200)
        self.assertEqual(memberships.data[0]["role"], "OWNER")

        payload = {**self.payload, "company_id": company_id}
        created = client.post("/api/v1/jobs/", payload, format="json")
        self.assertEqual(created.status_code, 201)
        job_id = created.data["id"]
        self.assertEqual(created.data["status"], "DRAFT")
        self.assertEqual(
            client.patch(f"/api/v1/jobs/{job_id}/", {"title": "Updated journey role"}, format="json").status_code,
            200,
        )
        self.assertEqual(client.post(f"/api/v1/jobs/{job_id}/publish/").status_code, 200)

        candidate = client.post(
            "/api/v1/auth/candidate/register/",
            {
                "email": "journey-applicant@example.test",
                "password": "Synthetic-pass-123!",
                "full_name": "Synthetic Journey Applicant",
            },
            format="json",
        )
        self.assertEqual(candidate.status_code, 201)
        candidate_login = client.post(
            "/api/v1/auth/login/",
            {"email": "journey-applicant@example.test", "password": "Synthetic-pass-123!"},
            format="json",
        )
        self.assertEqual(candidate_login.status_code, 200)
        applicant_client = self.client_class()
        applicant_client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {candidate_login.data['access']}"
        )
        applied = applicant_client.post(f"/api/v1/jobs/{job_id}/applications/", {}, format="json")
        self.assertEqual(applied.status_code, 201)
        application_id = applied.data["id"]

        applicants = client.get(f"/api/v1/jobs/{job_id}/applications/")
        self.assertEqual(applicants.status_code, 200)
        self.assertEqual(applicants.data["count"], 1)
        applicant_detail = client.get(
            f"/api/v1/jobs/{job_id}/applications/{application_id}/"
        )
        self.assertEqual(applicant_detail.status_code, 200)
        self.assertNotIn("email", applicant_detail.data["candidate"])
        status = client.patch(
            f"/api/v1/jobs/{job_id}/applications/{application_id}/status/",
            {"status": "REVIEWING"},
            format="json",
        )
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.data["status"], "REVIEWING")
        self.assertEqual(client.post(f"/api/v1/jobs/{job_id}/close/").status_code, 200)

    def test_company_job_visibility_and_cross_company_tampering(self):
        job_id = self.create_job().data["id"]
        url = f"/api/v1/companies/{self.company.pk}/jobs/"
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).data["count"], 0)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(url).data["count"], 1)
        other_company = create_company(
            recruiter=self.other.recruiter_profile, name="Synthetic Other Jobs"
        )
        self.client.force_authenticate(self.owner)
        self.assertEqual(
            self.client.get(f"/api/v1/companies/{other_company.pk}/jobs/").data["count"], 0
        )
        foreign = self.create_job(self.other, {**self.payload, "company_id": str(other_company.pk)})
        self.assertEqual(foreign.status_code, 201)
        self.client.force_authenticate(self.owner)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/jobs/{foreign.data['id']}/", {"title": "Tampered"}, format="json"
            ).status_code,
            403,
        )
        response = self.client.patch(
            f"/api/v1/jobs/{job_id}/", {"company_id": str(other_company.pk)}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_past_deadline_not_public(self):
        response = self.create_job()
        job_id = response.data["id"]
        self.client.post(f"/api/v1/jobs/{job_id}/publish/")
        from apps.jobs.models import Job

        Job.objects.filter(pk=job_id).update(
            application_deadline=timezone.localdate() - timedelta(days=1)
        )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/v1/jobs/{job_id}/").status_code, 404)

    def test_company_jobs_pagination_and_status_filter(self):
        from apps.jobs.models import Job

        for index in range(22):
            self.create_job(payload={**self.payload, "title": f"Synthetic page job {index}"})
        url = f"/api/v1/companies/{self.company.pk}/jobs/"
        first = self.client.get(url)
        self.assertEqual(first.data["count"], 22)
        self.assertIsNotNone(first.data["next"])
        second = self.client.get(url, {"page": 2})
        self.assertIsNotNone(second.data["previous"])
        self.assertFalse({item["id"] for item in first.data["results"]} & {item["id"] for item in second.data["results"]})
        self.assertEqual(self.client.get(url, {"status": Job.Status.PUBLISHED}).data["count"], 0)
