import uuid

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.test import TestCase

from apps.accounts.models import User

from .models import CandidateProfile, CandidateSkill, Skill


class CandidateModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("candidate@example.test", password="Test-pass-123")

    def test_profile_links_one_to_one_and_uses_uuid(self):
        profile = CandidateProfile.objects.create(user=self.user, full_name="Test Candidate")
        self.assertIsInstance(profile.pk, uuid.UUID)
        self.assertEqual(profile.user, self.user)
        with self.assertRaises(ValidationError):
            CandidateProfile.objects.create(user=self.user, full_name="Second Profile")

    def test_profile_rejects_non_candidate_user_and_invalid_values(self):
        recruiter = User.objects.create_user(
            "recruiter@example.test", password="Test-pass-123", role=User.Role.RECRUITER
        )
        with self.assertRaises(ValidationError):
            CandidateProfile.objects.create(user=recruiter, full_name="Not a candidate")
        with self.assertRaises(ValidationError):
            CandidateProfile.objects.create(
                user=self.user, full_name="Invalid country", country="usa"
            )
        with self.assertRaises(ValidationError):
            CandidateProfile.objects.create(
                user=self.user, full_name="Unknown country", country="ZZ"
            )
        CandidateProfile.objects.create(user=self.user, full_name="Valid Candidate", country="IN")
        profile = CandidateProfile.objects.get(user=self.user)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CandidateProfile.objects.filter(pk=profile.pk).update(country="ZZ")
        second_user = User.objects.create_user(
            "candidate2@example.test", password="Test-pass-123"
        )
        with (
            self.assertRaises(IntegrityError),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                """INSERT INTO candidates_candidateprofile
                    (id, user_id, full_name, professional_headline, country, city, about,
                     years_of_experience, current_designation, portfolio_url, github_url,
                     linkedin_url, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
                [uuid.uuid4(), second_user.pk, "Synthetic Invalid", "", "ZZ", "", "", 0, "", "", "", ""],
            )
        with self.assertRaises(IntegrityError), transaction.atomic():
            CandidateProfile.objects.filter(user=self.user).update(years_of_experience=-1)

    def test_skill_names_are_normalized_and_unique(self):
        skill = Skill.objects.create(name="  PyTHON   ")
        self.assertEqual(skill.name, "python")
        self.assertIsInstance(skill.pk, uuid.UUID)
        with self.assertRaises(ValidationError):
            Skill.objects.create(name="PYTHON")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Skill.objects.bulk_create([Skill(name=" Python ")])
        bulk_skill = Skill.objects.bulk_create([Skill(name="RUST\tLANG")])[0]
        self.assertEqual(bulk_skill.name, "rust lang")
        bulk_skill.name = " MySQL   8 "
        Skill.objects.bulk_update([bulk_skill], ["name"])
        bulk_skill.refresh_from_db()
        self.assertEqual(bulk_skill.name, "mysql 8")
        with (
            self.assertRaises(IntegrityError),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "UPDATE candidates_skill SET name = %s WHERE id = %s",
                [" BAD  NAME ", skill.pk],
            )
        with (
            self.assertRaises(IntegrityError),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "INSERT INTO candidates_skill (id, name, created_at) VALUES (%s, %s, CURRENT_TIMESTAMP)",
                [uuid.uuid4(), "NOT canonical"],
            )

    def test_skill_direct_sql_rejects_noncanonical_whitespace_and_case(self):
        invalid_names = (
            "python\tdeveloper",
            "python\ndeveloper",
            "python  developer",
            " Python",
            "Python",
            "python ",
            "python\u00a0developer",
        )
        for name in invalid_names:
            with (
                self.subTest(name=repr(name)),
                self.assertRaises(IntegrityError),
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                cursor.execute(
                    "INSERT INTO candidates_skill (id, name, created_at) "
                    "VALUES (%s, %s, CURRENT_TIMESTAMP)",
                    [uuid.uuid4(), name],
                )

    def test_skill_canonical_duplicates_and_supported_creation_paths(self):
        first = Skill.objects.create(name="  PyTHON\tDeveloper ")
        self.assertEqual(first.name, "python developer")
        with (
            self.assertRaises(IntegrityError),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "INSERT INTO candidates_skill (id, name, created_at) "
                "VALUES (%s, %s, CURRENT_TIMESTAMP)",
                [uuid.uuid4(), "python developer"],
            )
        bulk = Skill.objects.bulk_create([Skill(name="  RUST\nEngineer ")])[0]
        self.assertEqual(bulk.name, "rust engineer")

    def test_candidate_skill_pair_is_unique(self):
        profile = CandidateProfile.objects.create(user=self.user, full_name="Test Candidate")
        skill = Skill.objects.create(name="django")
        pair = CandidateSkill.objects.create(candidate=profile, skill=skill)
        self.assertIsInstance(pair.pk, uuid.UUID)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CandidateSkill.objects.create(candidate=profile, skill=skill)
