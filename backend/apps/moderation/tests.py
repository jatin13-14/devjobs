from django.db import DatabaseError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile
from apps.companies.services import create_company
from apps.jobs.models import Job
from apps.recruiters.models import RecruiterProfile

from .models import ModerationEvent


class ModerationTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("admin@example.test", "test-password")
        self.recruiter = User.objects.create_user("recruiter@example.test", role="recruiter")
        self.profile = RecruiterProfile.objects.create(user=self.recruiter, name="Test Recruiter")
        self.company = create_company(recruiter=self.profile, name="Test Company")
        self.candidate = User.objects.create_user("candidate@example.test")
        CandidateProfile.objects.create(user=self.candidate, full_name="Test Candidate")
        self.job = Job.objects.create(
            company=self.company,
            creator=self.recruiter,
            title="Developer",
            description="Test",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status="PUBLISHED",
        )
        self.client = APIClient()

    def decision(self, kind, obj, action):
        self.client.force_authenticate(self.admin)
        return self.client.post(
            f"/api/v1/admin/{kind}/{obj.pk}/",
            {"action": action, "reason": "Policy review"},
            format="json",
        )

    def test_permissions_and_privilege_fields(self):
        for actor in (None, self.candidate, self.recruiter):
            self.client.force_authenticate(actor)
            for path in ("overview", "history", "companies", "candidates", "recruiters", "jobs"):
                self.assertIn(self.client.get(f"/api/v1/admin/{path}/").status_code, (401, 403))
        self.client.force_authenticate(self.candidate)
        self.assertEqual(
            self.client.patch(
                "/api/v1/candidates/me/profile/", {"is_staff": True}, format="json"
            ).status_code,
            400,
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get("/api/v1/admin/overview/").status_code, 200)
        self.assertEqual(
            self.client.get("/api/v1/admin/candidates/?search=candidate&state=active").data[
                "count"
            ],
            1,
        )

    def test_company_enforcement_and_restore(self):
        self.assertEqual(self.decision("companies", self.company, "suspend").status_code, 200)
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{self.job.pk}/publish/").status_code, 403)
        self.assertEqual(
            self.client.get(f"/api/v1/jobs/{self.job.pk}/applications/").status_code, 403
        )
        self.client.force_authenticate(self.candidate)
        self.assertEqual(
            self.client.post(
                f"/api/v1/jobs/{self.job.pk}/applications/", {}, format="json"
            ).status_code,
            400,
        )
        self.assertEqual(self.client.get("/api/v1/jobs/").data["count"], 0)
        self.assertEqual(self.decision("companies", self.company, "reactivate").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/jobs/").data["count"], 1)

    def test_job_hold_cannot_be_bypassed(self):
        self.assertEqual(self.decision("jobs", self.job, "hide").status_code, 200)
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(self.client.post(f"/api/v1/jobs/{self.job.pk}/publish/").status_code, 403)
        self.client.force_authenticate(self.candidate)
        self.assertEqual(
            self.client.post(
                f"/api/v1/jobs/{self.job.pk}/applications/", {}, format="json"
            ).status_code,
            400,
        )
        self.assertEqual(self.client.get(f"/api/v1/jobs/{self.job.pk}/").status_code, 404)
        self.assertEqual(self.decision("jobs", self.job, "restore").status_code, 200)

    def test_audit_atomic_immutable_and_idempotence(self):
        self.assertEqual(self.decision("candidates", self.candidate, "suspend").status_code, 200)
        self.assertEqual(self.decision("candidates", self.candidate, "suspend").status_code, 400)
        event = ModerationEvent.objects.get()
        self.assertEqual(event.administrator, self.admin)
        self.assertEqual(event.reason, "Policy review")
        self.assertTrue(event.previous_state)
        self.assertFalse(event.new_state)
        with self.assertRaises(DatabaseError), transaction.atomic():
            ModerationEvent.objects.filter(pk=event.pk).update(reason="tampered")
        with self.assertRaises(DatabaseError), transaction.atomic():
            event.delete()
        self.assertEqual(
            self.client.patch("/api/v1/admin/history/", {}, format="json").status_code, 405
        )

    def test_suspended_users_existing_tokens_and_records(self):
        from rest_framework_simplejwt.tokens import RefreshToken

        from apps.applications.models import Application

        token = str(RefreshToken.for_user(self.candidate).access_token)
        application = Application.objects.create(
            candidate=self.candidate.candidate_profile, job=self.job
        )
        self.assertEqual(self.decision("candidates", self.candidate, "suspend").status_code, 200)
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        for path in ("profile", "applications", "resume"):
            self.assertEqual(self.client.get(f"/api/v1/candidates/me/{path}/").status_code, 401)
        self.assertTrue(Application.objects.filter(pk=application.pk).exists())
        self.client.credentials()
        self.assertEqual(self.decision("candidates", self.candidate, "reactivate").status_code, 200)
        self.assertEqual(self.decision("recruiters", self.recruiter, "suspend").status_code, 200)
        self.recruiter.refresh_from_db()
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(
            self.client.get(f"/api/v1/jobs/{self.job.pk}/applications/").status_code, 403
        )

    def test_resume_revocation_and_no_administrator_download(self):
        from apps.applications.models import Application
        from apps.candidates.models import CandidateResume

        application = Application.objects.create(
            candidate=self.candidate.candidate_profile, job=self.job
        )
        CandidateResume.objects.create(
            candidate=self.candidate.candidate_profile, storage_key="a" * 32 + ".pdf", size=100
        )
        url = f"/api/v1/jobs/{self.job.pk}/applications/{application.pk}/resume/"
        self.assertEqual(self.decision("companies", self.company, "suspend").status_code, 200)
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.decision("companies", self.company, "reactivate").status_code, 200)
        self.assertEqual(self.decision("candidates", self.candidate, "suspend").status_code, 200)
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertNotIn(
            "storage_key",
            str(self.client.get(f"/api/v1/admin/candidates/{self.candidate.pk}/").data),
        )


from django.test import TransactionTestCase


class ConcurrentModerationTests(TransactionTestCase):
    def test_duplicate_decisions_serialize_and_create_one_event(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier

        from django.db import close_old_connections

        admin = User.objects.create_superuser("concurrent-admin@example.test", "synthetic-password")
        candidate = User.objects.create_user("concurrent-target@example.test")
        CandidateProfile.objects.create(user=candidate, full_name="Synthetic Candidate")
        barrier = Barrier(2)

        def decide():
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=admin.pk))
                barrier.wait(timeout=10)
                return client.post(
                    f"/api/v1/admin/candidates/{candidate.pk}/",
                    {"action": "suspend", "reason": "Concurrent review"},
                    format="json",
                ).status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(decide) for _ in range(2)]
            statuses = [future.result(timeout=20) for future in futures]
        self.assertCountEqual(statuses, [200, 400])
        self.assertEqual(ModerationEvent.objects.count(), 1)

    def test_publish_racing_hide_cannot_remove_hold(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier

        from django.db import close_old_connections

        admin = User.objects.create_superuser("race-admin@example.test", "synthetic-password")
        owner = User.objects.create_user("race-owner@example.test", role="recruiter")
        profile = RecruiterProfile.objects.create(user=owner, name="Synthetic Owner")
        company = create_company(recruiter=profile, name="Synthetic Company")
        job = Job.objects.create(
            company=company,
            creator=owner,
            title="Developer",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
        )
        barrier = Barrier(2)

        def act(hide):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=admin.pk if hide else owner.pk))
                barrier.wait(timeout=10)
                url = f"/api/v1/admin/jobs/{job.pk}/" if hide else f"/api/v1/jobs/{job.pk}/publish/"
                return client.post(
                    url,
                    {"action": "hide", "reason": "Policy review"} if hide else {},
                    format="json",
                ).status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            hide = pool.submit(act, True)
            publish = pool.submit(act, False)
            self.assertEqual(hide.result(timeout=20), 200)
            self.assertIn(publish.result(timeout=20), (200, 403))
        job.refresh_from_db()
        self.assertTrue(job.is_hidden)
        client = APIClient()
        self.assertEqual(client.get(f"/api/v1/jobs/{job.pk}/").status_code, 404)
        self.assertEqual(ModerationEvent.objects.count(), 1)
