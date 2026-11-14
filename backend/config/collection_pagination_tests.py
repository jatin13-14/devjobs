"""HTTP contracts for temporary opt-in collection pagination."""

from urllib.parse import parse_qs, urlparse

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile, CandidateSkill, Skill
from apps.companies.models import Company, CompanyMembership
from apps.recruiters.models import RecruiterProfile


class CollectionPaginationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.candidate = User.objects.create_user("pagination-candidate@example.test")
        cls.profile = CandidateProfile.objects.create(
            user=cls.candidate, full_name="Synthetic pagination candidate"
        )
        cls.recruiter = User.objects.create_user(
            "pagination-recruiter@example.test", role=User.Role.RECRUITER
        )
        cls.recruiter_profile = RecruiterProfile.objects.create(
            user=cls.recruiter, name="Synthetic pagination recruiter"
        )
        cls.company = Company.objects.create(name="Synthetic pagination company")
        CompanyMembership.objects.create(
            company=cls.company, recruiter=cls.recruiter_profile, role="OWNER", status="ACTIVE"
        )
        for index in range(104):
            skill = Skill.objects.create(name=f"synthetic-{index:03}")
            CandidateSkill.objects.create(candidate=cls.profile, skill=skill)
            company = Company.objects.create(name=f"Synthetic {index:03}")
            CompanyMembership.objects.create(
                company=company, recruiter=cls.recruiter_profile, role="OWNER", status="ACTIVE"
            )
            user = User.objects.create_user(
                f"pagination-{index}@example.test", role=User.Role.RECRUITER
            )
            recruiter = RecruiterProfile.objects.create(user=user, name="Synthetic page member")
            CompanyMembership.objects.create(
                company=cls.company, recruiter=recruiter, role="MEMBER", status="INVITED"
            )

    def endpoints(self):
        return [
            (self.candidate, "/api/v1/candidates/me/skills/", 104),
            (self.recruiter, "/api/v1/recruiters/me/companies/", 105),
            (self.recruiter, f"/api/v1/companies/{self.company.pk}/members/", 105),
        ]

    def test_legacy_and_page_contracts(self):
        for user, url, count in self.endpoints():
            with self.subTest(url=url):
                self.client.force_authenticate(user)
                legacy = self.client.get(url).data
                self.assertIsInstance(legacy, list)
                self.assertEqual(len(legacy), count)
                for query in ("?page=2", "?page_size=1", "?page=invalid&page_size=-1"):
                    self.assertEqual(self.client.get(url + query).data, legacy)
                for query, status in (
                    ("?pagination=invalid&pagination=page", 200),
                    ("?pagination=page&pagination=invalid", 400),
                    ("?pagination=&pagination=page", 200),
                    ("?pagination=page&pagination=", 400),
                ):
                    self.assertEqual(self.client.get(url + query).status_code, status)
                linked = self.client.get(
                    url, {"pagination": "page", "page_size": 1, "audit_marker": "retained"}
                ).data
                self.assertEqual(
                    parse_qs(urlparse(linked["next"]).query)["audit_marker"], ["retained"]
                )
                first = self.client.get(url, {"pagination": "page"}).data
                self.assertEqual(set(first), {"count", "next", "previous", "results"})
                self.assertEqual(first["count"], count)
                self.assertEqual(first["results"], legacy[:20])
                self.assertIsNone(first["previous"])
                self.assertEqual(parse_qs(urlparse(first["next"]).query)["pagination"], ["page"])
                second = self.client.get(first["next"]).data
                self.assertEqual(second["results"], legacy[20:40])
                self.assertEqual(self.client.get(second["previous"]).data, first)
                last = self.client.get(url, {"pagination": "page", "page": "last"}).data
                self.assertEqual(last["results"], legacy[100:])
                self.assertIsNone(last["next"])
                for size in ("100", "100000"):
                    response = self.client.get(url, {"pagination": "page", "page_size": size}).data
                    self.assertEqual(response["results"], legacy[:100])
                for size in ("0", "-1", "invalid", ""):
                    self.assertEqual(
                        self.client.get(url, {"pagination": "page", "page_size": size}).data[
                            "results"
                        ],
                        legacy[:20],
                    )
                for mode in ("", "pages", "PAGE"):
                    self.assertEqual(self.client.get(url, {"pagination": mode}).status_code, 400)
                for page in ("0", "-1", "invalid", "999", "9" * 100):
                    response = self.client.get(url, {"pagination": "page", "page": page})
                    self.assertEqual(response.status_code, 404)
                    self.assertEqual(str(response.data["detail"]), "Invalid page.")

    def test_sql_slicing_and_constant_query_growth(self):
        for user, url, _ in self.endpoints():
            self.client.force_authenticate(user)
            counts = []
            for size in (1, 20, 100):
                with CaptureQueriesContext(connection) as queries:
                    response = self.client.get(url, {"pagination": "page", "page_size": size})
                    self.assertEqual(len(response.data["results"]), size)
                counts.append(len(queries))
                sql = [q["sql"] for q in queries]
                self.assertTrue(any(f"LIMIT {size}" in q for q in sql), sql)
                self.assertTrue(any("COUNT(" in q for q in sql), sql)
            self.assertEqual(counts, [counts[0]] * 3)
            print(f"Pagination SQL query counts {url}: sizes 1/20/100 = {counts}")
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get(url, {"pagination": "page", "page_size": 20, "page": 2})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(any("LIMIT 20 OFFSET 20" in q["sql"] for q in queries))

    def test_permissions_scope_and_empty(self):
        outsider = User.objects.create_user(
            "pagination-outsider@example.test", role=User.Role.RECRUITER
        )
        RecruiterProfile.objects.create(user=outsider, name="Synthetic outsider")
        other = User.objects.create_user("pagination-other@example.test")
        CandidateProfile.objects.create(user=other, full_name="Synthetic other candidate")
        for user, url, _ in self.endpoints():
            self.client.force_authenticate(None)
            self.assertEqual(self.client.get(url, {"pagination": "page"}).status_code, 401)
            self.client.force_authenticate(
                self.recruiter if user == self.candidate else self.candidate
            )
            self.assertEqual(self.client.get(url, {"pagination": "page"}).status_code, 403)
        for user, url in [
            (other, "/api/v1/candidates/me/skills/"),
            (outsider, "/api/v1/recruiters/me/companies/"),
        ]:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(url).data, [])
            self.assertEqual(
                self.client.get(url, {"pagination": "page"}).data,
                {"count": 0, "next": None, "previous": None, "results": []},
            )
        members = f"/api/v1/companies/{self.company.pk}/members/"
        self.client.force_authenticate(outsider)
        self.assertEqual(self.client.get(members, {"pagination": "page"}).status_code, 403)
        CompanyMembership.objects.create(
            company=self.company,
            recruiter=outsider.recruiter_profile,
            role="MEMBER",
            status="ACTIVE",
        )
        self.assertEqual(self.client.get(members, {"pagination": "page"}).status_code, 403)
        self.company.is_suspended = True
        self.company.save()
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(self.client.get(members, {"pagination": "page"}).status_code, 403)
        self.assertEqual(
            self.client.get("/api/v1/recruiters/me/companies/", {"pagination": "page"}).data[
                "count"
            ],
            104,
        )

    def test_independent_values_and_admin_access(self):
        self.client.force_authenticate(self.candidate)
        skills = self.client.get("/api/v1/candidates/me/skills/", {"pagination": "page"}).data[
            "results"
        ]
        self.assertEqual([s["name"] for s in skills], [f"synthetic-{i:03}" for i in range(20)])
        self.assertEqual(set(skills[0]), {"id", "name"})
        self.client.force_authenticate(self.recruiter)
        companies = self.client.get(
            "/api/v1/recruiters/me/companies/", {"pagination": "page"}
        ).data["results"]
        self.assertEqual([c["name"] for c in companies], [f"Synthetic {i:03}" for i in range(20)])
        self.assertEqual(set(companies[0]), {"id", "name", "membership_id", "role"})
        member = self.company.memberships.exclude(recruiter=self.recruiter_profile).first()
        member.role = "ADMIN"
        member.status = "ACTIVE"
        member.save()
        self.client.force_authenticate(member.recruiter.user)
        response = self.client.get(
            f"/api/v1/companies/{self.company.pk}/members/",
            {"pagination": "page", "page_size": 100},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 105)
        self.assertIn("INVITED", {m["status"] for m in response.data["results"]})

    def test_query_counts_at_one_twenty_and_hundred_records(self):
        counts = {url: [] for _, url, _ in self.endpoints()}
        for total in (100, 20, 1):
            keep_skills = list(
                CandidateSkill.objects.filter(candidate=self.profile)
                .order_by("skill__name")
                .values_list("pk", flat=True)[:total]
            )
            CandidateSkill.objects.filter(candidate=self.profile).exclude(
                pk__in=keep_skills
            ).delete()
            keep_companies = list(
                Company.objects.exclude(pk=self.company.pk)
                .order_by("name", "pk")
                .values_list("pk", flat=True)[: total - 1]
            )
            Company.objects.exclude(pk=self.company.pk).exclude(pk__in=keep_companies).delete()
            keep_members = list(
                self.company.memberships.exclude(recruiter=self.recruiter_profile)
                .order_by("created_at", "id")
                .values_list("pk", flat=True)[: total - 1]
            )
            self.company.memberships.exclude(recruiter=self.recruiter_profile).exclude(
                pk__in=keep_members
            ).delete()
            for user, url, _ in self.endpoints():
                self.client.force_authenticate(user)
                with CaptureQueriesContext(connection) as queries:
                    response = self.client.get(url, {"pagination": "page", "page_size": 100})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["count"], total)
                self.assertEqual(len(response.data["results"]), total)
                counts[url].append(len(queries))
        for url, measured in counts.items():
            self.assertEqual(measured, [measured[0]] * 3)
            print(f"Pagination dataset counts {url}: records 100/20/1 = {measured}")

    def test_recruiter_company_filters_and_legacy_compatibility(self):
        self.client.force_authenticate(self.recruiter)
        url = "/api/v1/recruiters/me/companies/"
        company_id = str(self.company.pk)
        for search in ("PAGINATION", "  pagination  "):
            response = self.client.get(url, {"pagination": "page", "search": search})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["count"], 1)
            self.assertEqual(response.data["results"][0]["id"], company_id)
        for filters in (
            {"company_id": company_id},
            {"company_id": company_id, "search": "pagination"},
        ):
            response = self.client.get(url, {"pagination": "page", **filters})
            self.assertEqual(response.data["count"], 1)
            self.assertEqual(response.data["results"][0]["id"], company_id)
        for filters in (
            {"company_id": "invalid"},
            {"company_id": ""},
            {"search": "x" * 201},
            {"search": "bad\x00value"},
        ):
            self.assertEqual(
                self.client.get(url, {"pagination": "page", **filters}).status_code, 400
            )
            self.assertEqual(len(self.client.get(url, filters).data), 105)
        for filters in (
            {"company_id": "00000000-0000-4000-8000-000000000001"},
            {"search": "no match"},
            {"company_id": company_id, "search": "no match"},
        ):
            self.assertEqual(
                self.client.get(url, {"pagination": "page", **filters}).data["count"], 0
            )
        response = self.client.get(
            url + "?pagination=page&search=absent&search=Synthetic&page_size=1"
        )
        self.assertEqual(response.data["count"], 105)
        query = parse_qs(urlparse(response.data["next"]).query)
        self.assertEqual(query["search"][-1], "Synthetic")
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(
                url, {"pagination": "page", "search": "Synthetic", "page_size": 1, "page": 2}
            )
        self.assertTrue(any("LIMIT 1 OFFSET 1" in item["sql"] for item in queries))
        self.assertTrue(any("COUNT(" in item["sql"] for item in queries))
        self.assertEqual(response.data["count"], 105)

    def test_recruiter_exact_lookup_preserves_eligibility_and_privacy(self):
        url = "/api/v1/recruiters/me/companies/"
        self.client.force_authenticate(self.recruiter)
        filters = {"pagination": "page", "company_id": str(self.company.pk)}
        membership = CompanyMembership.objects.get(
            company=self.company, recruiter=self.recruiter_profile
        )
        for status in ("INVITED", "SUSPENDED"):
            # Owner invariant requires an active owner; change this test row to MEMBER first.
            other = User.objects.create_user(
                f"filter-{status.lower()}@example.test", role=User.Role.RECRUITER
            )
            profile = RecruiterProfile.objects.create(user=other, name="Synthetic filter member")
            CompanyMembership.objects.create(
                company=self.company, recruiter=profile, role="MEMBER", status=status
            )
            self.client.force_authenticate(other)
            self.assertEqual(self.client.get(url, filters).data["count"], 0)
        self.client.force_authenticate(self.recruiter)
        self.company.is_suspended = True
        self.company.save(update_fields=["is_suspended"])
        self.assertEqual(self.client.get(url, filters).data["count"], 0)
        self.assertEqual(membership.status, "ACTIVE")
