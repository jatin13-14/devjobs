"""Stage 2B.3 contract audit using isolated test-only candidate records."""

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile, CandidateSkill, Skill


class CandidateSkillsContractTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.candidate = User.objects.create_user("skills-a@example.test")
        cls.profile = CandidateProfile.objects.create(
            user=cls.candidate, full_name="Synthetic skills candidate A"
        )
        cls.other = User.objects.create_user("skills-b@example.test")
        cls.other_profile = CandidateProfile.objects.create(
            user=cls.other, full_name="Synthetic skills candidate B"
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.candidate)
        self.url = "/api/v1/candidates/me/skills/"

    def test_normalization_reuse_and_private_association(self):
        created = self.client.post(self.url, {"name": "  C++\t CAFÉ  "}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["name"], "c++ café")
        self.assertEqual(set(created.data), {"id", "name"})
        repeated = self.client.post(self.url, {"name": "C++ café"}, format="json")
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(repeated.data, created.data)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url).data, [])
        self.assertEqual(self.client.delete(self.url + created.data["id"] + "/").status_code, 404)
        self.assertEqual(CandidateSkill.objects.filter(candidate=self.profile).count(), 1)

    def test_all_methods_require_candidate_role(self):
        skill = Skill.objects.create(name="synthetic role check")
        CandidateSkill.objects.create(candidate=self.profile, skill=skill)
        for role, expected in ((None, 401), (User.Role.RECRUITER, 403), (User.Role.ADMIN, 403)):
            if role is None:
                user = None
            elif role == User.Role.ADMIN:
                user = User.objects.create_superuser("skills-admin@example.test", password=None)
            else:
                user = User.objects.create_user(f"skills-{role}@example.test", role=role)
            self.client.force_authenticate(user)
            with self.subTest(role=role):
                self.assertEqual(self.client.get(self.url).status_code, expected)
                self.assertEqual(
                    self.client.post(self.url, {"name": "go"}, format="json").status_code, expected
                )
                self.assertEqual(self.client.delete(f"{self.url}{skill.pk}/").status_code, expected)
        self.assertEqual(CandidateSkill.objects.filter(candidate=self.profile).count(), 1)

    def test_invalid_input_has_field_errors_without_side_effects(self):
        for payload in (
            {"name": ""},
            {"name": " \t "},
            {"name": "x" * 81},
            {"name": None},
            {"name": "go", "user_id": str(self.other.pk)},
            {"name": "a\x00b"},
        ):
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, 400)
        self.assertEqual(Skill.objects.count(), 0)
        self.assertEqual(CandidateSkill.objects.count(), 0)

    def test_valid_ascii_unicode_and_expansion_at_model_limit(self):
        for raw, canonical in (
            ("Python", "python"),
            ("日本語", "日本語"),
            ("İ" * 40, "i\u0307" * 40),
        ):
            with self.subTest(raw=raw):
                response = self.client.post(self.url, {"name": raw}, format="json")
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["name"], canonical)
                self.assertTrue(Skill.objects.filter(name=canonical).exists())

    def test_pagination_after_last_page_deletion(self):
        for index in range(3):
            skill = Skill.objects.create(name=f"synthetic-{index}")
            CandidateSkill.objects.create(candidate=self.profile, skill=skill)
        legacy = self.client.get(self.url).data
        self.assertIsInstance(legacy, list)
        page = self.client.get(self.url, {"pagination": "page", "page_size": 2, "page": 2})
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page.data["count"], 3)
        self.assertEqual(page.data["results"], legacy[2:])
        self.assertEqual(self.client.delete(self.url + legacy[2]["id"] + "/").status_code, 204)
        self.assertEqual(
            self.client.get(
                self.url, {"pagination": "page", "page_size": 2, "page": 2}
            ).status_code,
            404,
        )
        fallback = self.client.get(self.url, {"pagination": "page", "page_size": 2, "page": 1})
        self.assertEqual(fallback.data["results"], legacy[:2])
        self.assertEqual(fallback.data["count"], 2)

    def test_unicode_lowercase_expansion_returns_validation_error(self):
        # U+0130 lowercases to two code points. Raw length passes the serializer,
        # but the canonical value exceeds Skill.name's 80-character limit.
        self.client.raise_request_exception = False
        response = self.client.post(self.url, {"name": "\u0130" * 80}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.data)
        self.assertEqual(Skill.objects.count(), 0)
        self.assertEqual(CandidateSkill.objects.count(), 0)
