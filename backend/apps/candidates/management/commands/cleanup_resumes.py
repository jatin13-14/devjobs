"""Offline reconciliation: stop upload/delete workers before using --delete."""

import time

from django.core.management.base import BaseCommand

from apps.candidates.models import CandidateResume
from apps.candidates.resumes import KEY_PATTERN, storage


class Command(BaseCommand):
    help = "Count orphan private resumes; --delete requires stopped resume writers. No paths are printed."

    def add_arguments(self, parser):
        parser.add_argument("--delete", action="store_true")
        parser.add_argument("--min-age-hours", type=int, default=24)

    def handle(self, *args, **options):
        backend = storage()
        if not backend.exists(""):
            self.stdout.write("Orphans: 0")
            return
        referenced = set(CandidateResume.objects.values_list("storage_key", flat=True))
        _, files = backend.listdir("")
        cutoff = time.time() - max(24, options["min_age_hours"]) * 3600
        count = 0
        for key in files:
            if (
                KEY_PATTERN.fullmatch(key)
                and key not in referenced
                and backend.get_modified_time(key).timestamp() < cutoff
            ):
                count += 1
                if options["delete"]:
                    backend.delete(key)
        self.stdout.write(f"Orphans: {count}; deleted: {count if options['delete'] else 0}")
