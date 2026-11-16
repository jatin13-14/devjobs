"""Skill service rollback and exception boundaries."""

from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase

from apps.candidates import skills_contract_tests as contract_fixtures
from apps.candidates.models import CandidateSkill, Skill
from apps.candidates.services import add_candidate_skill


class CandidateSkillServiceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        contract_fixtures.CandidateSkillsContractTests.setUpTestData.__func__(cls)

    def test_other_validation_errors_are_not_masked_by_an_existing_skill(self):
        Skill.objects.create(name="service skill")
        error = ValidationError({"name": ValidationError("Invalid", code="invalid")})
        with (
            patch.object(Skill.objects, "get_or_create", side_effect=error),
            self.assertRaises(ValidationError),
        ):
            add_candidate_skill(candidate=self.profile, name="service skill")
        self.assertEqual(CandidateSkill.objects.count(), 0)

    def test_unique_validation_without_a_committed_winner_is_not_masked(self):
        error = ValidationError({"name": ValidationError("Duplicate", code="unique")})
        with (
            patch.object(Skill.objects, "get_or_create", side_effect=error),
            self.assertRaises(ValidationError),
        ):
            add_candidate_skill(candidate=self.profile, name="absent skill")
        self.assertEqual(Skill.objects.count(), 0)

    def test_association_failure_rolls_back_new_global_skill(self):
        with (
            patch.object(
                CandidateSkill.objects,
                "get_or_create",
                side_effect=IntegrityError("association failure"),
            ),
            self.assertRaises(IntegrityError),
        ):
            add_candidate_skill(candidate=self.profile, name="rolled back skill")
        self.assertEqual(Skill.objects.count(), 0)
        self.assertEqual(CandidateSkill.objects.count(), 0)
