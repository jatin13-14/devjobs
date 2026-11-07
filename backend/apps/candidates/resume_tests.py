import io
import os
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import DatabaseError, transaction
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from pypdf import PdfWriter
from rest_framework.test import APITestCase

from apps.applications import api_tests as application_tests
from apps.applications.models import Application
from apps.companies.models import CompanyMembership
from apps.jobs.models import Job

from .models import CandidateResume
from .resumes import remove_resume, replace_resume, storage


def pdf(encrypted=False):
    output = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    if encrypted:
        writer.encrypt("synthetic-password")
    writer.write(output)
    return output.getvalue()


class ResumeTests(APITestCase):
    user = application_tests.ApplicationApiTests.user

    def setUp(self):
        application_tests.ApplicationApiTests.setUp(self)
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        settings = override_settings(PRIVATE_RESUME_ROOT=self.directory.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.url = "/api/v1/candidates/me/resume/"
        self.client.force_authenticate(self.candidate)
        self.application = Application.objects.create(
            candidate=self.candidate.candidate_profile, job=self.job
        )
        self.recruiter_url = (
            f"/api/v1/jobs/{self.job.pk}/applications/{self.application.pk}/resume/"
        )

    def upload(self, data=None, name="resume.pdf", mime="application/pdf"):
        return self.client.put(
            self.url,
            {"file": SimpleUploadedFile(name, pdf() if data is None else data, content_type=mime)},
            format="multipart",
        )

    def read_download(self, url):
        response = self.client.get(url)
        if response.status_code == 200:
            self.assertEqual(b"".join(response.streaming_content), pdf())
            self.assertEqual(response["Cache-Control"], "private, no-store")
            self.assertEqual(response["X-Content-Type-Options"], "nosniff")
            self.assertIn('attachment; filename="resume.pdf"', response["Content-Disposition"])
        return response

    def test_upload_metadata_replace_delete_and_owner_download(self):
        self.assertEqual(self.client.get(self.url).data, {"resume": None})
        self.assertEqual(self.client.get(self.url + "download/").status_code, 404)
        self.assertEqual(self.upload().status_code, 200)
        first = CandidateResume.objects.get().storage_key
        self.assertEqual(os.stat(storage().path(first)).st_mode & 0o777, 0o600)
        data = self.client.get(self.url).data["resume"]
        self.assertEqual(set(data), {"filename", "content_type", "size", "updated_at"})
        self.assertEqual(data["size"], len(pdf()))
        self.assertEqual(self.read_download(self.url + "download/").status_code, 200)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.upload(name='../../private\\unsafe".pdf').status_code, 200)
        second = CandidateResume.objects.get().storage_key
        self.assertNotEqual(first, second)
        self.assertFalse(storage().exists(first))
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(self.url).status_code, 204)
        self.assertFalse(storage().exists(second))
        self.assertEqual(self.client.delete(self.url).status_code, 204)
        self.assertEqual(self.client.get(self.recruiter_url).status_code, 403)

    def test_validation_rejects_spoofed_empty_truncated_encrypted_and_oversized(self):
        self.upload()
        original = CandidateResume.objects.get().storage_key
        for content in (b"", b"not a PDF", b"%PDF-1.7\nmalformed\n%%EOF", pdf()[:-12], pdf(True)):
            self.assertEqual(self.upload(content).status_code, 400)
        with override_settings(RESUME_MAX_BYTES=100):
            self.assertEqual(self.upload().status_code, 400)
        self.assertEqual(self.client.put(self.url, {}, format="multipart").status_code, 400)
        self.assertEqual(
            self.client.put(
                self.url,
                {"file": SimpleUploadedFile("x.pdf", pdf()), "candidate": "other"},
                format="multipart",
            ).status_code,
            400,
        )
        self.assertEqual(CandidateResume.objects.get().storage_key, original)
        # Content is authoritative; client filename/MIME are discarded.
        self.assertEqual(self.upload(name="anything.txt", mime="text/plain").status_code, 200)

    def test_candidate_and_anonymous_isolation(self):
        self.upload()
        self.client.force_authenticate(self.other_candidate)
        self.assertEqual(self.client.get(self.url).data, {"resume": None})
        self.assertEqual(self.client.get(self.url + "download/").status_code, 404)
        self.assertEqual(self.client.delete(self.url).status_code, 204)
        self.assertEqual(CandidateResume.objects.count(), 1)
        for user in (self.owner, self.member, self.admin):
            self.client.force_authenticate(user)
            for method, path in (
                ("get", self.url),
                ("get", self.url + "download/"),
                ("delete", self.url),
            ):
                self.assertEqual(getattr(self.client, method)(path).status_code, 403)
            self.assertEqual(self.upload().status_code, 403)
        self.client.force_authenticate(None)
        for url in (self.url, self.url + "download/", self.recruiter_url):
            self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.upload().status_code, 401)
        self.assertEqual(self.client.delete(self.url).status_code, 401)

    def test_recruiter_company_roles_and_application_scoping(self):
        self.upload()
        for user, expected in (
            (self.owner, 200),
            (self.admin, 200),
            (self.member, 403),
            (self.other, 403),
            (self.other_candidate, 403),
        ):
            self.client.force_authenticate(user)
            self.assertEqual(self.read_download(self.recruiter_url).status_code, expected)
        other_job = Job.objects.create(
            company=self.company,
            creator=self.owner,
            title="Other",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
        )
        self.client.force_authenticate(self.owner)
        self.assertEqual(
            self.client.get(
                self.recruiter_url.replace(str(self.job.pk), str(other_job.pk))
            ).status_code,
            404,
        )
        # Even an OWNER of another company receives no access.
        from apps.companies.services import create_company

        create_company(recruiter=self.other.recruiter_profile, name="Other synthetic company")
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.recruiter_url).status_code, 403)

    def test_lifecycle_policy(self):
        self.upload()
        self.client.force_authenticate(self.admin)
        self.job.status = Job.Status.CLOSED
        self.job.application_deadline = timezone.localdate() - timedelta(days=1)
        self.job.save()
        for status in ("SUBMITTED", "REVIEWING", "SHORTLISTED", "REJECTED"):
            self.application.status = status
            self.application.save()
            self.assertEqual(self.read_download(self.recruiter_url).status_code, 200)
        membership = CompanyMembership.objects.get(recruiter=self.admin.recruiter_profile)
        membership.status = "SUSPENDED"
        membership.save()
        self.assertEqual(self.client.get(self.recruiter_url).status_code, 403)
        membership.status = "ACTIVE"
        membership.role = "MEMBER"
        membership.save()
        self.assertEqual(self.client.get(self.recruiter_url).status_code, 403)
        self.client.force_authenticate(self.owner)
        self.application.status = "WITHDRAWN"
        self.application.save()
        self.assertEqual(self.client.get(self.recruiter_url).status_code, 404)
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.read_download(self.url + "download/").status_code, 200)

    def test_deleted_and_deactivated_candidate_revoke_recruiter_access(self):
        self.upload()
        self.candidate.is_active = False
        self.candidate.save()
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.recruiter_url).status_code, 404)
        self.candidate.is_active = True
        self.candidate.save()
        self.client.force_authenticate(self.candidate)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.delete(self.url)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.recruiter_url).status_code, 404)

    def test_failed_replacement_preserves_old_file_and_removes_new(self):
        self.upload()
        first = CandidateResume.objects.get().storage_key
        with patch(
            "apps.candidates.resumes.CandidateResume.objects.update_or_create",
            side_effect=DatabaseError("synthetic"),
        ):
            self.assertEqual(self.upload().status_code, 503)
        self.assertEqual(CandidateResume.objects.get().storage_key, first)
        self.assertEqual(os.listdir(self.directory.name), [first])
        with patch(
            "django.core.files.storage.filesystem.FileSystemStorage.save",
            side_effect=OSError("sensitive/path"),
        ):
            response = self.upload()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("sensitive", str(response.data))
        self.assertTrue(storage().exists(first))

    def test_failed_delete_preserves_reference_and_file(self):
        self.upload()
        first = CandidateResume.objects.get().storage_key
        with (
            patch.object(CandidateResume, "delete", side_effect=DatabaseError("synthetic")),
            self.assertRaises(DatabaseError),
        ):
            remove_resume(self.candidate.candidate_profile)
        self.assertTrue(storage().exists(first))
        self.assertEqual(CandidateResume.objects.get().storage_key, first)

    def test_outer_transaction_rejected_and_no_file_written(self):
        with transaction.atomic(), self.assertRaises(RuntimeError):
            replace_resume(self.candidate.candidate_profile, pdf())
        self.assertEqual(os.listdir(self.directory.name), [])

    def test_bad_storage_keys_missing_files_and_public_urls(self):
        self.upload()
        resume = CandidateResume.objects.get()
        for key in ("../secret.pdf", "/etc/passwd", "a" * 32 + ".pdf"):
            resume.storage_key = key
            resume.save()
            response = self.client.get(self.url + "download/")
            self.assertEqual(response.status_code, 404)
            self.assertNotIn(self.directory.name, str(response.data))
        for path in ("/media/resume.pdf", "/private-resumes/resume.pdf"):
            self.assertEqual(self.client.get(path).status_code, 404)

    def test_cleanup_failure_is_recoverable_and_reconciliation_protects_live_files(self):
        self.upload()
        first = CandidateResume.objects.get().storage_key
        with (
            patch(
                "django.core.files.storage.filesystem.FileSystemStorage.delete",
                side_effect=OSError("synthetic"),
            ),
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.assertEqual(self.upload().status_code, 200)
        self.assertTrue(storage().exists(first))
        old = timezone.now().timestamp() - 25 * 3600
        os.utime(Path(self.directory.name) / first, (old, old))
        output = io.StringIO()
        call_command("cleanup_resumes", stdout=output)
        self.assertIn("Orphans: 1; deleted: 0", output.getvalue())
        self.assertTrue(storage().exists(first))
        call_command("cleanup_resumes", delete=True, stdout=io.StringIO())
        self.assertFalse(storage().exists(first))
        self.assertTrue(storage().exists(CandidateResume.objects.get().storage_key))


class ConcurrentResumeTests(TransactionTestCase):
    def test_concurrent_replacements_keep_only_the_committed_file(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier

        from django.db import close_old_connections

        from apps.accounts.models import User

        from .models import CandidateProfile

        user = User.objects.create_user(
            "resume-concurrent@example.test", password="Synthetic-pass-123!", role="candidate"
        )
        candidate = CandidateProfile.objects.create(user=user, full_name="Synthetic Candidate")
        barrier = Barrier(2)
        data = pdf()
        with (
            tempfile.TemporaryDirectory() as directory,
            override_settings(PRIVATE_RESUME_ROOT=directory),
        ):

            def replace():
                close_old_connections()
                try:
                    profile = CandidateProfile.objects.get(pk=candidate.pk)
                    barrier.wait(timeout=10)
                    replace_resume(profile, data)
                finally:
                    close_old_connections()

            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = [executor.submit(replace) for _ in range(2)]
                for future in futures:
                    future.result(timeout=20)
            resume = CandidateResume.objects.get(candidate=candidate)
            self.assertEqual(os.listdir(directory), [resume.storage_key])
