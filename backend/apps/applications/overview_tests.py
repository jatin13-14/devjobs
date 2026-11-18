"""Real database security, calendar and query growth for bounded summaries."""

from datetime import UTC, datetime
from unittest.mock import patch
from uuid import uuid4

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile
from apps.companies.models import CompanyMembership
from apps.companies.services import create_company
from apps.jobs.models import Job
from apps.recruiters.models import RecruiterProfile

from .models import Application


class CompanyApplicationOverviewTests(APITestCase):
    def setUp(self):
        self.owner = self.recruiter("overview-owner")
        self.company = create_company(recruiter=self.owner.recruiter_profile, name="Overview Labs")
        self.candidate = User.objects.create_user("overview-candidate@example.test")
        self.profile = CandidateProfile.objects.create(
            user=self.candidate, full_name="Synthetic candidate"
        )
        self.url = f"/api/v1/companies/{self.company.pk}/application-overview/"
        self.client.force_authenticate(self.owner)

    def recruiter(self, name):
        user = User.objects.create_user(f"{name}@example.test", role="recruiter")
        RecruiterProfile.objects.create(user=user, name=name)
        return user

    def application(self, number, *, company=None, status="SUBMITTED", at=None):
        job = Job.objects.create(
            company=company or self.company,
            creator=self.owner,
            title=f"Job {number}",
            description="Synthetic",
            employment_type="FULL_TIME",
            workplace_type="REMOTE",
            experience_level="MID",
            status="PUBLISHED",
        )
        item = Application.objects.create(
            candidate=self.profile, job=job, status=status, cover_letter="Must not appear"
        )
        if at:
            Application.objects.filter(pk=item.pk).update(applied_at=at)
        return item

    def test_empty_summary_has_real_zero_values_and_seven_days(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["time_zone"], "UTC")
        self.assertEqual(
            [response.data[key] for key in ("total", "submitted", "reviewing")], [0, 0, 0]
        )
        self.assertEqual(len(response.data["days"]), 7)
        self.assertEqual([day["count"] for day in response.data["days"]], [0] * 7)
        self.assertEqual(response.data["recent"], [])

    def test_all_status_totals_and_recent_rows_are_company_scoped_and_bounded(self):
        for index, status in enumerate(
            ["SUBMITTED", "REVIEWING", "SHORTLISTED", "REJECTED", "WITHDRAWN"]
        ):
            self.application(index, status=status)
        outsider = self.recruiter("overview-other")
        company = create_company(recruiter=outsider.recruiter_profile, name="Other company")
        self.application(99, company=company)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [response.data[key] for key in ("total", "submitted", "reviewing")], [5, 1, 1]
        )
        self.assertEqual(len(response.data["recent"]), 3)
        for row in response.data["recent"]:
            self.assertEqual(set(row), {"id", "applied_at", "job", "candidate"})
            self.assertEqual(set(row["candidate"]), {"full_name", "professional_headline"})
            self.assertEqual(set(row["job"]), {"id", "title"})
            self.assertNotEqual(row["job"]["title"], "Job 99")

    def test_calendar_days_use_requested_zone_across_dst_and_month_boundary(self):
        timestamps = [
            "2026-03-02T04:59:59+00:00",
            "2026-03-02T05:00:00+00:00",
            "2026-03-08T05:00:00+00:00",
            "2026-03-09T03:59:59+00:00",
            "2026-03-09T04:00:00+00:00",
        ]
        for index, timestamp in enumerate(timestamps):
            self.application(index, at=datetime.fromisoformat(timestamp))
        now = datetime(2026, 3, 8, 12, tzinfo=UTC)
        with patch("apps.applications.overview.timezone.now", return_value=now):
            response = self.client.get(self.url, {"time_zone": "America/New_York"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 5)
        self.assertEqual([day["count"] for day in response.data["days"]], [1, 0, 0, 0, 0, 0, 2])
        self.assertEqual(response.data["days"][0]["date"], "2026-03-02")
        self.assertEqual(response.data["days"][-1]["date"], "2026-03-08")

    def test_recent_order_breaks_timestamp_ties_by_id(self):
        at = datetime(2026, 3, 2, tzinfo=UTC)
        items = [self.application(index, at=at) for index in range(5)]
        response = self.client.get(self.url)
        self.assertEqual(
            [row["id"] for row in response.data["recent"]], sorted(item.pk for item in items)[:3]
        )

    def test_authorization_matrix_and_revocation(self):
        admin = self.recruiter("overview-admin")
        member = self.recruiter("overview-member")
        outsider = self.recruiter("overview-outsider")
        for user, role in [(admin, "ADMIN"), (member, "MEMBER")]:
            CompanyMembership.objects.create(
                company=self.company, recruiter=user.recruiter_profile, role=role, status="ACTIVE"
            )
        staff = User.objects.create_superuser("overview-staff@example.test", "Synthetic-pass-123!")
        for user, expected in [
            (self.owner, 200),
            (admin, 200),
            (member, 403),
            (outsider, 403),
            (self.candidate, 403),
            (staff, 403),
            (None, 401),
        ]:
            with self.subTest(user=user):
                self.client.force_authenticate(user)
                self.assertEqual(self.client.get(self.url).status_code, expected)
        self.client.force_authenticate(admin)
        membership = CompanyMembership.objects.get(
            company=self.company, recruiter=admin.recruiter_profile
        )
        for status in ["INVITED", "SUSPENDED"]:
            membership.status = status
            membership.save(update_fields=["status"])
            self.assertEqual(self.client.get(self.url).status_code, 403)
        membership.delete()
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.client.force_authenticate(self.owner)
        self.company.is_suspended = True
        self.company.save(update_fields=["is_suspended"])
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_invalid_zones_and_inaccessible_companies_fail_without_data(self):
        for zone in ["", "Not/AZone", "../UTC", "x" * 129]:
            with self.subTest(zone=zone):
                response = self.client.get(self.url, {"time_zone": zone})
                self.assertEqual(response.status_code, 400)
                self.assertIn("time_zone", response.data)
        self.assertEqual(
            self.client.get(f"/api/v1/companies/{uuid4()}/application-overview/").status_code, 403
        )
        self.owner.is_active = False
        self.owner.save(update_fields=["is_active"])
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_query_count_does_not_grow_with_jobs_or_applications(self):
        counts = []
        for size in [1, 20, 50]:
            for number in range(Application.objects.count(), size):
                self.application(number)
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get(self.url)
                response.render()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["total"], size)
            self.assertEqual(len(response.data["recent"]), min(3, size))
            counts.append(len(queries))
            self.assertTrue(any("LIMIT 3" in query["sql"] for query in queries))
        self.assertEqual(len(set(counts)), 1, counts)
        print(f"Overview query counts at 1/20/50 rows: {counts}")
