"""Keyset HTTP contracts on the runner's owned disposable PostgreSQL."""

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.applications.models import Application
from apps.companies.models import Company
from apps.jobs.models import Job
from config import collection_pagination_tests as legacy


class KeysetPaginationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        legacy.CollectionPaginationTests.setUpTestData.__func__(cls)
        cls.jobs = Job.objects.bulk_create(
            [
                Job(
                    company=cls.company,
                    creator=cls.recruiter,
                    title=f"Pagination {index}",
                    description="Pagination regression fixture",
                    employment_type="FULL_TIME",
                    workplace_type="REMOTE",
                    experience_level="MID",
                    status="PUBLISHED",
                    published_at=timezone.now(),
                )
                for index in range(1200)
            ]
        )
        # Deliberately tied timestamps exceed DRF's offset-cursor cutoff.
        Job.objects.update(created_at=timezone.now())
        Application.objects.bulk_create(
            [Application(candidate=cls.profile, job=job) for job in cls.jobs]
        )
        Application.objects.update(applied_at=timezone.now())

    def endpoints(self):
        return legacy.CollectionPaginationTests.endpoints(self) + [
            (self.candidate, "/api/v1/candidates/me/applications/", 1200),
            (self.recruiter, f"/api/v1/jobs/{self.jobs[0].pk}/applications/", 1),
            (self.candidate, "/api/v1/jobs/", 1200),
            (self.recruiter, f"/api/v1/companies/{self.company.pk}/jobs/", 1200),
        ]

    def test_bounded_count_free_queries_and_complete_tie_traversal(self):
        for user, url, total in self.endpoints():
            with self.subTest(url=url):
                self.client.force_authenticate(user)
                ids = []
                next_url = url + "?pagination=cursor&page_size=100"
                query_counts = []
                while next_url:
                    with CaptureQueriesContext(connection) as queries:
                        response = self.client.get(next_url)
                    self.assertEqual(response.status_code, 200, response.data)
                    self.assertEqual(set(response.data), {"next", "previous", "results"})
                    self.assertIsNone(response.data["previous"])
                    self.assertLessEqual(len(response.data["results"]), 100)
                    sql = " ".join(row["sql"] for row in queries).upper()
                    self.assertNotIn("COUNT(", sql)
                    self.assertNotIn("OFFSET", sql)
                    self.assertIn("LIMIT 101", sql)
                    query_counts.append(len(queries))
                    ids.extend(row["id"] for row in response.data["results"])
                    next_url = response.data["next"]
                self.assertEqual(len(ids), total)
                self.assertEqual(len(set(ids)), total)
                self.assertEqual(len(set(query_counts)), 1)

    def test_sizes_empty_and_invalid_tokens(self):
        self.client.force_authenticate(self.candidate)
        url = "/api/v1/candidates/me/skills/"
        for size, expected in (("9999", 100), ("0", 20), ("-1", 20), ("bad", 20), ("1", 1)):
            response = self.client.get(url, {"pagination": "cursor", "page_size": size})
            self.assertEqual(len(response.data["results"]), expected)
        for token in ("", "bad", "a" * 16385):
            self.assertEqual(
                self.client.get(url, {"pagination": "cursor", "cursor": token}).status_code, 400
            )
        response = self.client.get(url, {"pagination": "cursor", "page_size": 100})
        with patch(
            "django.core.signing.time.time", return_value=timezone.now().timestamp() + 86402
        ):
            self.assertEqual(self.client.get(response.data["next"]).status_code, 400)
        self.profile.candidate_skills.all().delete()
        self.assertEqual(
            self.client.get(url, {"pagination": "cursor"}).data,
            {"next": None, "previous": None, "results": []},
        )

    def test_cursor_scope_permissions_and_role_isolation(self):
        self.client.force_authenticate(self.recruiter)
        url = f"/api/v1/companies/{self.company.pk}/members/"
        link = self.client.get(url, {"pagination": "cursor", "page_size": 1}).data["next"]
        self.assertEqual(self.client.get(link + "&search=changed").status_code, 400)
        token = parse_qs(urlparse(link).query)["cursor"][0]
        self.assertEqual(
            self.client.get(
                "/api/v1/recruiters/me/companies/", {"pagination": "cursor", "cursor": token}
            ).status_code,
            400,
        )
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.get(link).status_code, 403)
        self.assertEqual(
            self.client.get(
                f"/api/v1/jobs/{self.jobs[0].pk}/applications/", {"pagination": "cursor"}
            ).status_code,
            403,
        )
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(
            self.client.get(
                "/api/v1/candidates/me/applications/", {"pagination": "cursor"}
            ).status_code,
            403,
        )
        Company.objects.filter(pk=self.company.pk).update(is_suspended=True)
        self.assertEqual(self.client.get(link).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(link).status_code, 401)

    def test_other_candidate_cannot_reuse_cursor(self):
        self.client.force_authenticate(self.candidate)
        link = self.client.get(
            "/api/v1/candidates/me/applications/", {"pagination": "cursor", "page_size": 1}
        ).data["next"]
        other = User.objects.create_user("pagination-other@example.test")
        from apps.candidates.models import CandidateProfile

        CandidateProfile.objects.create(user=other, full_name="Synthetic pagination candidate")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(link).status_code, 400)
        empty = self.client.get("/api/v1/candidates/me/applications/", {"pagination": "cursor"})
        self.assertEqual(empty.data["results"], [])

    def test_insert_delete_between_pages_does_not_shift_unchanged_rows(self):
        self.client.force_authenticate(self.candidate)
        url = "/api/v1/candidates/me/applications/"
        first = self.client.get(url, {"pagination": "cursor", "page_size": 20})
        expected = list(
            Application.objects.order_by("-applied_at", "id").values_list("id", flat=True)
        )[20:40]
        Application.objects.filter(pk=first.data["results"][0]["id"]).delete()
        # A new earlier row must not displace the next existing page.
        Application.objects.create(
            candidate=self.profile, job_id=first.data["results"][0]["job"]["id"]
        )
        second = self.client.get(first.data["next"])
        self.assertEqual(
            [row["id"] for row in second.data["results"]], [str(pk) for pk in expected]
        )

    def test_scoped_job_lookup_and_legacy_contract(self):
        self.client.force_authenticate(self.recruiter)
        url = f"/api/v1/companies/{self.company.pk}/jobs/"
        Job.objects.filter(pk=self.jobs[0].pk).update(status="DRAFT", published_at=None)
        response = self.client.get(
            url, {"job_id": self.jobs[0].pk, "pagination": "cursor", "page_size": 1}
        )
        self.assertEqual([row["id"] for row in response.data["results"]], [str(self.jobs[0].pk)])
        self.assertIsNone(response.data["next"])
        self.assertEqual(self.client.get(url, {"job_id": "bad"}).status_code, 400)
        self.client.force_authenticate(self.candidate)
        self.assertEqual(
            self.client.get(url, {"job_id": self.jobs[0].pk, "pagination": "cursor"}).data[
                "results"
            ],
            [],
        )
        self.assertEqual(set(self.client.get(url).data), {"count", "next", "previous", "results"})

    def test_query_plan_evidence(self):
        import json

        from django.db.models import F, Field, Func, Value
        from django.db.models.lookups import LessThan

        with connection.cursor() as cursor:
            cursor.execute("ANALYZE jobs_job")
        ordered = Job.objects.order_by("-created_at", "-id")
        boundary = ordered[1099]
        seek = ordered.filter(
            LessThan(
                Func(F("created_at"), F("id"), function="ROW", output_field=Field()),
                Func(
                    Value(boundary.created_at),
                    Value(boundary.id),
                    function="ROW",
                    output_field=Field(),
                ),
            )
        )
        for label, queryset in (("offset", ordered[1100:1120]), ("keyset", seek[:20])):
            plan = json.loads(queryset.explain(format="json", analyze=True, buffers=True))[0]
            print(f"M06 PLAN {label}: {json.dumps(plan)}")
            if label == "keyset":
                scan = plan["Plan"]["Plans"][0]
                self.assertEqual(scan["Index Name"], "jobs_cursor_created_idx")
                self.assertIn("ROW(created_at, id)", scan["Index Cond"])
                self.assertEqual(scan["Actual Rows"], 20)
        self.client.force_authenticate(self.candidate)
        for mode, expected in (("page", 3), ("cursor", 2)):
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get("/api/v1/jobs/", {"pagination": mode, "page_size": 3})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(queries), expected)
            print(f"M06 QUERY public jobs {mode}: {len(queries)} queries")

    def test_admin_cursor_requires_admin_and_revalidates_every_page(self):
        url = "/api/v1/admin/companies/"
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(self.client.get(url, {"pagination": "cursor"}).status_code, 403)
        self.recruiter.is_staff = True
        self.recruiter.save(update_fields=["is_staff"])
        self.client.force_authenticate(self.recruiter)
        link = url + "?pagination=cursor&page_size=1"
        seen = []
        while link:
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get(link)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertNotIn("COUNT(", " ".join(row["sql"] for row in queries).upper())
            seen.extend(row["id"] for row in response.data["results"])
            link = response.data["next"]
        self.assertEqual(len(seen), 105)
        link = self.client.get(url, {"pagination": "cursor", "page_size": 1}).data["next"]
        self.recruiter.is_staff = False
        self.recruiter.save(update_fields=["is_staff"])
        self.assertEqual(self.client.get(link).status_code, 403)

    def test_cursor_ignores_unsafe_application_ordering(self):
        self.client.force_authenticate(self.candidate)
        url = "/api/v1/candidates/me/applications/"
        expected = [
            str(pk)
            for pk in Application.objects.order_by("-applied_at", "id").values_list(
                "pk", flat=True
            )[:40]
        ]
        first = self.client.get(
            url, {"pagination": "cursor", "ordering": "withdrawn_at", "page_size": 20}
        )
        second = self.client.get(first.data["next"])
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            [row["id"] for row in first.data["results"] + second.data["results"]], expected
        )
