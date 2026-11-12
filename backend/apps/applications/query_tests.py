"""HTTP query growth guards; fixture writes are outside captured requests."""

from collections import Counter

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile, CandidateResume, CandidateSkill, Skill
from apps.companies.services import create_company
from apps.jobs.models import Job
from apps.recruiters.models import RecruiterProfile

from .models import Application


class ApplicationQueryTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("query-owner@example.test", role="recruiter")
        self.recruiter = RecruiterProfile.objects.create(user=self.owner, name="Query owner")
        self.company = create_company(recruiter=self.recruiter, name="Query company")
        self.admin = User.objects.create_superuser(
            "query-admin@example.test", "Synthetic-pass-123!"
        )
        self.candidate = self.make_candidate(100)
        self.job = self.make_job(self.company, 100)

    def make_candidate(self, number):
        user = User.objects.create_user(f"query-candidate-{number}@example.test")
        profile = CandidateProfile.objects.create(user=user, full_name=f"Candidate {number}")
        for prefix in ("zeta", "alpha"):
            skill = Skill.objects.create(name=f"{prefix} {number}")
            CandidateSkill.objects.create(candidate=profile, skill=skill)
        if number % 2 == 0:
            CandidateResume.objects.create(
                candidate=profile, storage_key=f"{number:032x}.pdf", size=100
            )
        return profile

    def make_job(self, company, number):
        return Job.objects.create(
            company=company,
            creator=self.owner,
            title=f"Job {number}",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status="PUBLISHED",
        )

    def measure(self, url, user, size):
        self.client.force_authenticate(user)
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(url, HTTP_HOST="127.0.0.1")
            response.render()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], size)
        self.assertEqual(len(response.data["results"]), size)
        self.assertEqual(len({str(row["id"]) for row in response.data["results"]}), size)
        tables = Counter()
        for query in queries:
            sql = query["sql"]
            for table in (
                "accounts_user",
                "candidates_candidateresume",
                "candidates_candidateskill",
                "candidates_candidateprofile",
                "recruiters_recruiterprofile",
            ):
                if f'FROM "{table}"' in sql:
                    tables[table] += 1
        print(f"QUERY {url} rows={size} total={len(queries)} related={dict(tables)}")
        return len(queries), response.data["results"]

    def assert_bounded(self, counts):
        # Authentication is forced; only endpoint SQL is measured. One fixed
        # prefetch is allowed, but adding 19 rows must not add per-row queries.
        self.assertLessEqual(max(counts) - min(counts), 1, counts)

    def test_candidate_list_query_growth(self):
        counts = []
        expected = {}
        for number in range(20):
            company = create_company(recruiter=self.recruiter, name=f"Company {number}")
            job = self.make_job(company, number)
            application = Application.objects.create(candidate=self.candidate, job=job)
            expected[str(application.pk)] = job
            if number + 1 in (1, 5, 20):
                count, rows = self.measure(
                    "/api/v1/candidates/me/applications/", self.candidate.user, number + 1
                )
                counts.append(count)
                for row in rows:
                    job = expected[row["id"]]
                    self.assertEqual(
                        row["job"],
                        {"id": str(job.pk), "title": job.title, "company": job.company.name},
                    )
                    self.assertEqual(row["candidate"]["skills"], ["alpha 100", "zeta 100"])
                    self.assertTrue(row["resume_available"])
                    self.assertNotIn("storage_key", str(row))
        self.assert_bounded(counts)

    def test_recruiter_list_query_growth(self):
        counts = []
        expected = {}
        for number in range(20):
            profile = self.make_candidate(number)
            application = Application.objects.create(candidate=profile, job=self.job)
            expected[str(application.pk)] = number
            if number + 1 in (1, 5, 20):
                count, rows = self.measure(
                    f"/api/v1/jobs/{self.job.pk}/applications/", self.owner, number + 1
                )
                counts.append(count)
                for row in rows:
                    index = expected[row["id"]]
                    self.assertEqual(row["candidate"]["full_name"], f"Candidate {index}")
                    self.assertEqual(
                        row["candidate"]["skills"], [f"alpha {index}", f"zeta {index}"]
                    )
                    self.assertEqual(row["resume_available"], index % 2 == 0)
                    self.assertNotIn("storage_key", str(row))
        self.assert_bounded(counts)

    def test_admin_profile_list_query_growth(self):
        all_counts = []
        for kind in ("candidates", "recruiters"):
            counts = []
            for number in range(20):
                user = User.objects.create_user(
                    f"query-{kind}-{number}@example.test",
                    role="candidate" if kind == "candidates" else "recruiter",
                )
                if kind == "candidates":
                    CandidateProfile.objects.create(user=user, full_name=f"Profile {number}")
                else:
                    RecruiterProfile.objects.create(user=user, name=f"Profile {number}")
                if number + 1 in (1, 5, 20):
                    count, rows = self.measure(
                        f"/api/v1/admin/{kind}/?search=query-{kind}-", self.admin, number + 1
                    )
                    counts.append(count)
                    self.assertEqual(
                        {row["name"] for row in rows}, {f"Profile {i}" for i in range(number + 1)}
                    )
                    self.assertTrue(all(row["is_active"] for row in rows))
                    self.assertNotIn("storage_key", str(rows))
            all_counts.append(counts)
        for counts in all_counts:
            self.assert_bounded(counts)

    def test_visibility_pagination_and_permissions(self):
        from apps.companies.models import CompanyMembership

        expected = []
        for number in range(21):
            profile = self.make_candidate(number)
            status = "WITHDRAWN" if number == 0 else "SUBMITTED"
            application = Application.objects.create(candidate=profile, job=self.job, status=status)
            expected.insert(0, str(application.pk))
        own = Application.objects.create(candidate=self.candidate, job=self.job)
        expected.insert(0, str(own.pk))
        url = f"/api/v1/jobs/{self.job.pk}/applications/"
        self.client.force_authenticate(self.owner)
        first = self.client.get(url, HTTP_HOST="127.0.0.1")
        second = self.client.get(url + "?page=2", HTTP_HOST="127.0.0.1")
        self.assertEqual(first.data["count"], 22)
        self.assertEqual(
            [row["id"] for row in first.data["results"] + second.data["results"]], expected
        )
        self.assertFalse(second.data["results"][-1]["resume_available"])
        self.candidate.user.is_active = False
        self.candidate.user.save(update_fields=["is_active"])
        self.assertFalse(
            self.client.get(url, HTTP_HOST="127.0.0.1").data["results"][0]["resume_available"]
        )
        self.candidate.user.is_active = True
        self.candidate.user.save(update_fields=["is_active"])
        self.client.force_authenticate(self.candidate.user)
        mine = self.client.get("/api/v1/candidates/me/applications/", HTTP_HOST="127.0.0.1")
        self.assertEqual([row["id"] for row in mine.data["results"]], [str(own.pk)])
        other = Application.objects.exclude(pk=own.pk).first()
        self.assertEqual(
            self.client.get(
                f"/api/v1/candidates/me/applications/{other.pk}/", HTTP_HOST="127.0.0.1"
            ).status_code,
            404,
        )
        outsider = User.objects.create_user("query-outsider@example.test", role="recruiter")
        profile = RecruiterProfile.objects.create(user=outsider, name="Outsider")
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.get(url, HTTP_HOST="127.0.0.1").status_code, 403)
        CompanyMembership.objects.create(
            company=self.company, recruiter=profile, role="MEMBER", status="ACTIVE"
        )
        self.assertEqual(self.client.get(url, HTTP_HOST="127.0.0.1").status_code, 403)
        self.assertEqual(
            self.client.get(url + f"{own.pk}/resume/", HTTP_HOST="127.0.0.1").status_code, 403
        )
        CompanyMembership.objects.filter(recruiter=profile).update(role="ADMIN")
        self.assertEqual(self.client.get(url, HTTP_HOST="127.0.0.1").status_code, 200)
        for user in (None, self.candidate.user, outsider):
            self.client.force_authenticate(user)
            self.assertIn(
                self.client.get("/api/v1/admin/candidates/", HTTP_HOST="127.0.0.1").status_code,
                (401, 403),
            )

    def test_admin_missing_profiles_and_state_filter(self):
        user = User.objects.create_user("query-no-profile@example.test", is_active=False)
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/v1/admin/candidates/?search=query-no-profile&state=restricted",
            HTTP_HOST="127.0.0.1",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "")
        self.assertEqual(str(response.data["results"][0]["id"]), str(user.pk))
