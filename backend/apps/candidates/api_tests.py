import uuid

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.candidates.models import CandidateProfile, CandidateSkill, Skill
from apps.recruiters.models import RecruiterProfile


class ProfileApiTests(TestCase):
    def setUp(self):
        self.candidate = User.objects.create_user("candidate-profile@example.test", password="Strong-pass-123")
        self.candidate_profile = CandidateProfile.objects.create(user=self.candidate, full_name="Synthetic Candidate")
        self.other_candidate = User.objects.create_user("other-candidate@example.test", password="Strong-pass-123")
        CandidateProfile.objects.create(user=self.other_candidate, full_name="Other Candidate")
        self.recruiter = User.objects.create_user(
            "recruiter-profile@example.test", password="Strong-pass-123", role=User.Role.RECRUITER
        )
        self.recruiter_profile = RecruiterProfile.objects.create(user=self.recruiter, name="Synthetic Recruiter")
        self.client = APIClient()

    def test_candidate_owns_profile_and_partial_update_rejects_protected_fields(self):
        self.client.force_authenticate(self.candidate)
        response = self.client.get("/api/v1/candidates/me/profile/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.candidate_profile.pk))
        updated = self.client.patch(
            "/api/v1/candidates/me/profile/",
            {"professional_headline": "Backend engineer"},
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["full_name"], "Synthetic Candidate")
        self.assertEqual(updated.data["professional_headline"], "Backend engineer")
        for field in ("user", "user_id", "id", "role", "password", "email"):
            rejected = self.client.patch("/api/v1/candidates/me/profile/", {field: str(self.other_candidate.pk)}, format="json")
            self.assertEqual(rejected.status_code, 400, field)
        self.assertEqual(self.candidate_profile.user_id, self.candidate.pk)

    def test_candidate_profile_validation(self):
        self.client.force_authenticate(self.candidate)
        response = self.client.patch("/api/v1/candidates/me/profile/", {"country": "usa"}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.patch("/api/v1/candidates/me/profile/", {"years_of_experience": 81}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.patch("/api/v1/candidates/me/profile/", {"not_a_field": "x"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_role_and_authentication_boundaries(self):
        self.assertEqual(self.client.get("/api/v1/candidates/me/profile/").status_code, 401)
        self.client.force_authenticate(self.recruiter)
        self.assertEqual(self.client.get("/api/v1/candidates/me/profile/").status_code, 403)
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.get("/api/v1/recruiters/me/profile/").status_code, 403)
        admin = User.objects.create_superuser("profile-admin@example.test", password="Strong-pass-123")
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.get("/api/v1/candidates/me/profile/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/recruiters/me/profile/").status_code, 403)

    def test_skill_list_create_reuse_duplicate_and_remove(self):
        self.client.force_authenticate(self.candidate)
        existing = Skill.objects.create(name="python")
        added = self.client.post("/api/v1/candidates/me/skills/", {"name": "  PYTHON\t"}, format="json")
        self.assertEqual(added.status_code, 201)
        self.assertEqual(added.data["id"], str(existing.pk))
        self.assertEqual(Skill.objects.count(), 1)
        repeated = self.client.post("/api/v1/candidates/me/skills/", {"name": "Python"}, format="json")
        self.assertEqual(repeated.status_code, 200)
        self.assertEqual(CandidateSkill.objects.filter(candidate=self.candidate_profile).count(), 1)
        self.assertEqual(self.client.get("/api/v1/candidates/me/skills/").data[0]["name"], "python")
        deleted = self.client.delete(f"/api/v1/candidates/me/skills/{existing.pk}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(CandidateSkill.objects.filter(candidate=self.candidate_profile).exists())

    def test_skill_rejects_invalid_payload_and_cross_account_delete(self):
        self.client.force_authenticate(self.candidate)
        skill = Skill.objects.create(name="rust")
        CandidateSkill.objects.create(candidate=CandidateProfile.objects.get(user=self.other_candidate), skill=skill)
        self.assertEqual(self.client.post("/api/v1/candidates/me/skills/", {"name": "  "}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/candidates/me/skills/", {"name": "Go", "user_id": str(self.other_candidate.pk)}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/v1/candidates/me/skills/{skill.pk}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/v1/candidates/me/skills/{uuid.uuid4()}/").status_code, 404)

    def test_database_constraint_prevents_duplicate_candidate_skill(self):
        skill = Skill.objects.create(name="django")
        CandidateSkill.objects.create(candidate=self.candidate_profile, skill=skill)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CandidateSkill.objects.create(candidate=self.candidate_profile, skill=skill)

    def test_recruiter_profile_ownership_partial_update_and_protected_fields(self):
        self.client.force_authenticate(self.recruiter)
        response = self.client.get("/api/v1/recruiters/me/profile/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.recruiter_profile.pk))
        updated = self.client.patch("/api/v1/recruiters/me/profile/", {"designation": "Talent Partner"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["name"], "Synthetic Recruiter")
        for field in ("user", "user_id", "id", "role", "email"):
            rejected = self.client.patch("/api/v1/recruiters/me/profile/", {field: str(self.candidate.pk)}, format="json")
            self.assertEqual(rejected.status_code, 400, field)
        self.assertEqual(self.client.patch("/api/v1/recruiters/me/profile/", {"work_email": "invalid"}, format="json").status_code, 400)
