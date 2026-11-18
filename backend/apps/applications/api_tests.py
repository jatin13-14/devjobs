import io
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from pypdf import PdfWriter
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile
from apps.companies.models import CompanyMembership
from apps.companies.services import create_company
from apps.jobs.models import Job
from apps.recruiters.models import RecruiterProfile

from .models import Application


class ApplicationApiTests(APITestCase):
    def user(self, name, role):
        user = User.objects.create_user(
            f"{name}@example.test", password="Synthetic-pass-123!", role=role
        )
        if role == User.Role.CANDIDATE:
            CandidateProfile.objects.create(user=user, full_name=f"Synthetic {name}")
        else:
            RecruiterProfile.objects.create(user=user, name=f"Synthetic {name}")
        return user

    def setUp(self):
        self.owner = self.user("app-owner", User.Role.RECRUITER)
        self.member = self.user("app-member", User.Role.RECRUITER)
        self.admin = self.user("app-admin", User.Role.RECRUITER)
        self.other = self.user("app-other", User.Role.RECRUITER)
        self.company = create_company(
            recruiter=self.owner.recruiter_profile, name="Synthetic App Co"
        )
        CompanyMembership.objects.create(
            company=self.company,
            recruiter=self.member.recruiter_profile,
            role="MEMBER",
            status="ACTIVE",
        )
        CompanyMembership.objects.create(
            company=self.company,
            recruiter=self.admin.recruiter_profile,
            role="ADMIN",
            status="ACTIVE",
        )
        self.candidate = self.user("app-candidate", User.Role.CANDIDATE)
        self.other_candidate = self.user("other-candidate", User.Role.CANDIDATE)
        self.job = Job.objects.create(
            company=self.company,
            creator=self.owner,
            title="Backend Engineer",
            description="Synthetic job",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status=Job.Status.PUBLISHED,
            published_at=timezone.now(),
            application_deadline=timezone.localdate() + timedelta(days=3),
        )
        self.apply_url = f"/api/v1/jobs/{self.job.pk}/applications/"
        self.mine_url = "/api/v1/candidates/me/applications/"

    def apply(self, user=None, data=None):
        self.client.force_authenticate(user or self.candidate)
        return self.client.post(self.apply_url, data or {}, format="json")

    def test_candidate_apply_list_retrieve_and_withdraw(self):
        response = self.apply(data={"cover_letter": "Synthetic cover letter"})
        self.assertEqual(response.status_code, 201)
        application_id = response.data["id"]
        self.assertEqual(response.data["status"], "SUBMITTED")
        self.assertEqual(self.client.get(self.mine_url).data["count"], 1)
        self.assertEqual(
            self.client.get(self.mine_url).data["results"][0]["candidate"]["full_name"],
            "Synthetic app-candidate",
        )
        detail = f"{self.mine_url}{application_id}/"
        self.assertEqual(self.client.get(detail).status_code, 200)
        self.assertEqual(
            self.client.patch(detail, {"status": "REJECTED"}, format="json").status_code, 400
        )
        withdrawn = self.client.patch(detail, {}, format="json")
        self.assertEqual(withdrawn.status_code, 200)
        self.assertEqual(withdrawn.data["status"], "WITHDRAWN")
        self.assertIsNotNone(withdrawn.data["withdrawn_at"])
        self.assertEqual(self.client.patch(detail, {}, format="json").status_code, 400)

    def test_registered_candidate_completes_discovery_and_application_journey(self):
        client = APIClient()
        registered = client.post(
            "/api/v1/auth/candidate/register/",
            {
                "email": "journey-candidate@example.test",
                "password": "Synthetic-pass-123!",
                "full_name": "Synthetic Journey Candidate",
            },
            format="json",
        )
        self.assertEqual(registered.status_code, 201)
        login = client.post(
            "/api/v1/auth/login/",
            {"email": "journey-candidate@example.test", "password": "Synthetic-pass-123!"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        self.assertEqual(client.get("/api/v1/candidates/me/profile/").status_code, 200)
        with tempfile.TemporaryDirectory() as root, override_settings(PRIVATE_RESUME_ROOT=root):
            pdf = io.BytesIO()
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            writer.write(pdf)
            uploaded = client.put(
                "/api/v1/candidates/me/resume/",
                {"file": SimpleUploadedFile("synthetic.pdf", pdf.getvalue(), "application/pdf")},
                format="multipart",
            )
            self.assertEqual(uploaded.status_code, 200)
            downloaded = client.get("/api/v1/candidates/me/resume/download/")
            self.assertEqual(downloaded.status_code, 200)
            self.assertEqual(client.delete("/api/v1/candidates/me/resume/").status_code, 204)
        self.assertEqual(client.get("/api/v1/jobs/?search=Backend").data["count"], 1)
        self.assertEqual(client.get(f"/api/v1/jobs/{self.job.pk}/").status_code, 200)

        application = client.post(self.apply_url, {"cover_letter": "Synthetic journey"}, format="json")
        self.assertEqual(application.status_code, 201)
        application_id = application.data["id"]
        self.assertEqual(client.get(self.mine_url).data["count"], 1)
        self.assertEqual(client.get(f"{self.mine_url}{application_id}/").status_code, 200)
        refreshed = client.post(
            "/api/v1/auth/token/refresh/", {"refresh": login.data["refresh"]}, format="json"
        )
        self.assertEqual(refreshed.status_code, 200)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
        withdrawn = client.patch(f"{self.mine_url}{application_id}/", {}, format="json")
        self.assertEqual(withdrawn.status_code, 200)
        self.assertEqual(withdrawn.data["status"], "WITHDRAWN")

    def test_duplicate_and_ineligible_job_rejected(self):
        self.assertEqual(self.apply().status_code, 201)
        self.assertEqual(self.apply().status_code, 400)
        other = Job.objects.create(
            company=self.company,
            creator=self.owner,
            title="Draft",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
        )
        self.assertEqual(self.apply_url_for(other).status_code, 400)
        expired = Job.objects.create(
            company=self.company,
            creator=self.owner,
            title="Expired",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status="PUBLISHED",
            application_deadline=timezone.localdate() - timedelta(days=1),
        )
        self.assertEqual(self.apply_url_for(expired).status_code, 400)
        closed = Job.objects.create(
            company=self.company,
            creator=self.owner,
            title="Closed",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status="CLOSED",
        )
        self.assertEqual(self.apply_url_for(closed).status_code, 400)

    def apply_url_for(self, job):
        self.client.force_authenticate(self.candidate)
        return self.client.post(f"/api/v1/jobs/{job.pk}/applications/", {}, format="json")

    def test_candidate_and_anonymous_access_and_ownership(self):
        created = self.apply()
        detail = f"{self.mine_url}{created.data['id']}/"
        self.client.force_authenticate(self.other_candidate)
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(self.mine_url).status_code, (401, 403))
        self.assertIn(self.client.post(self.apply_url, {}, format="json").status_code, (401, 403))

    def test_recruiter_ownership_roles_and_status_transitions(self):
        created = self.apply()
        application_id = created.data["id"]
        list_url = self.apply_url
        detail_url = f"{list_url}{application_id}/"
        status_url = f"{detail_url}status/"
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get(list_url).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(list_url).data["count"], 1)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(list_url).status_code, (401, 403))
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(list_url).data["count"], 1)
        recruiter_detail = self.client.get(detail_url).data
        self.assertNotIn("email", recruiter_detail["candidate"])
        self.assertNotIn("id", recruiter_detail["candidate"])
        self.assertNotIn("phone", recruiter_detail["candidate"])
        self.assertEqual(
            self.client.patch(status_url, {"status": "REVIEWING"}, format="json").status_code, 200
        )
        self.assertEqual(
            self.client.patch(status_url, {"status": "SUBMITTED"}, format="json").status_code, 400
        )
        other_company = create_company(
            recruiter=self.other.recruiter_profile, name="Other Synthetic Co"
        )
        other_job = Job.objects.create(
            company=other_company,
            creator=self.other,
            title="Other job",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status="PUBLISHED",
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/jobs/{other_job.pk}/applications/{application_id}/"
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(f"/api/v1/jobs/{other_job.pk}/applications/").status_code, 403
        )

    def test_wrong_job_application_id_cannot_be_updated(self):
        created = self.apply()
        other_job = Job.objects.create(
            company=self.company,
            creator=self.owner,
            title="Other job",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status="PUBLISHED",
        )
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            f"/api/v1/jobs/{other_job.pk}/applications/{created.data['id']}/status/",
            {"status": "REJECTED"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)


class ConcurrentApplicationApiTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        owner = User.objects.create_user(
            "concurrent-owner@example.test",
            password="Synthetic-pass-123!",
            role=User.Role.RECRUITER,
        )
        recruiter = RecruiterProfile.objects.create(user=owner, name="Synthetic Owner")
        company = create_company(recruiter=recruiter, name="Synthetic Concurrent Co")
        self.candidate = User.objects.create_user(
            "concurrent-candidate@example.test",
            password="Synthetic-pass-123!",
            role=User.Role.CANDIDATE,
        )
        CandidateProfile.objects.create(user=self.candidate, full_name="Synthetic Candidate")
        self.job_id = Job.objects.create(
            company=company,
            creator=owner,
            title="Concurrent Backend Engineer",
            description="Synthetic job",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status=Job.Status.PUBLISHED,
        ).pk

    def test_concurrent_requests_create_one_application(self):
        barrier = Barrier(2)
        candidate_id, job_id = self.candidate.pk, self.job_id

        def submit():
            close_old_connections()
            try:
                candidate = User.objects.get(pk=candidate_id)
                client = APIClient()
                client.force_authenticate(candidate)
                barrier.wait(timeout=10)
                return client.post(
                    f"/api/v1/jobs/{job_id}/applications/", {}, format="json"
                ).status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(lambda _index: submit(), range(2)))

        self.assertCountEqual(statuses, (201, 400))
        self.assertEqual(
            Application.objects.filter(candidate__user_id=candidate_id, job_id=job_id).count(), 1
        )
