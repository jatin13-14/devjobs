"""Real PostgreSQL contention using the existing isolated contract fixtures."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event, local
from unittest.mock import patch

from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.candidates import skills_contract_tests as contract_fixtures
from apps.candidates.models import CandidateSkill, Skill


class CandidateSkillConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.assertEqual(connection.vendor, "postgresql", "PostgreSQL is required")
        with connection.cursor() as cursor:
            cursor.execute("SHOW server_version_num")
            self.assertEqual(int(cursor.fetchone()[0]) // 10000, 17)
        contract_fixtures.CandidateSkillsContractTests.setUpTestData.__func__(type(self))

    def race(self, same_candidate, delayed_validation):
        for names, canonical in (
            (("  Concurrent  Skill  ", "concurrent skill"), "concurrent skill"),
            ((" CAFÉ  İ ", "café i\u0307"), "café i\u0307"),
        ):
            with self.subTest(names=names):
                self.race_names(names, canonical, same_candidate, delayed_validation)

    def race_names(self, names, canonical, same_candidate, delayed_validation):
        Skill.objects.all().delete()
        ready, committed, worker = Barrier(2), Event(), local()
        original_save, original_clean = Skill.save, Skill.full_clean

        def save(skill, *args, **kwargs):
            # Both get_or_create lookups have observed an absent name.
            ready.wait(timeout=10)
            if worker.index == 1 and not committed.wait(timeout=10):
                raise AssertionError("First API request did not complete")
            return original_save(skill, *args, **kwargs)

        def clean(skill, *args, **kwargs):
            original_clean(skill, *args, **kwargs)
            # Both validation snapshots pass before either INSERT.
            ready.wait(timeout=10)

        def request(index):
            close_old_connections()
            worker.index = index
            try:
                candidate_id = self.candidate.pk if same_candidate or index == 0 else self.other.pk
                client = APIClient()
                client.raise_request_exception = False
                client.force_authenticate(User.objects.get(pk=candidate_id))
                response = client.post(
                    "/api/v1/candidates/me/skills/", {"name": names[index]}, format="json"
                )
                return response.status_code, getattr(response, "data", None)
            finally:
                if index == 0:
                    committed.set()
                close_old_connections()

        method, replacement = ("save", save) if delayed_validation else ("full_clean", clean)
        with (
            patch.object(Skill, method, replacement),
            ThreadPoolExecutor(max_workers=2) as pool,
        ):
            results = list(pool.map(request, (0, 1)))
        self.assertEqual(
            sorted(result[0] for result in results),
            [200, 201] if same_candidate else [201, 201],
        )
        self.assertEqual(Skill.objects.filter(name=canonical).count(), 1)
        self.assertEqual(Skill.objects.count(), 1)
        self.assertEqual(CandidateSkill.objects.count(), 1 if same_candidate else 2)
        self.assertEqual(results[0][1]["id"], results[1][1]["id"])
        for profile in [self.profile] if same_candidate else [self.profile, self.other_profile]:
            self.assertEqual(
                CandidateSkill.objects.filter(candidate=profile, skill__name=canonical).count(),
                1,
            )

    def test_same_candidate_unique_constraint_contention(self):
        self.race(same_candidate=True, delayed_validation=False)

    def test_different_candidates_unique_constraint_contention(self):
        self.race(same_candidate=False, delayed_validation=False)

    def test_same_candidate_insert_between_lookup_and_validation(self):
        self.race(same_candidate=True, delayed_validation=True)

    def test_different_candidates_insert_between_lookup_and_validation(self):
        self.race(same_candidate=False, delayed_validation=True)
