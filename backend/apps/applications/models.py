import uuid

from django.conf import settings
from django.db import models


class Application(models.Model):
    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        REVIEWING = "REVIEWING", "Reviewing"
        SHORTLISTED = "SHORTLISTED", "Shortlisted"
        REJECTED = "REJECTED", "Rejected"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        "candidates.CandidateProfile", on_delete=models.PROTECT, related_name="applications"
    )
    job = models.ForeignKey("jobs.Job", on_delete=models.CASCADE, related_name="applications")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SUBMITTED)
    cover_letter = models.TextField(blank=True, max_length=5000)
    applied_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-applied_at", "id")
        constraints = (
            models.UniqueConstraint(
                fields=("candidate", "job"), name="applications_candidate_job_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    status__in=("SUBMITTED", "REVIEWING", "SHORTLISTED", "REJECTED", "WITHDRAWN")
                ),
                name="applications_status_valid",
            ),
        )
        indexes = (
            models.Index(
                fields=("job", "status", "applied_at"), name="applications_job_status_idx"
            ),
        )


class ApplicationStatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="status_history"
    )
    previous_status = models.CharField(
        max_length=12, choices=Application.Status.choices, blank=True
    )
    new_status = models.CharField(max_length=12, choices=Application.Status.choices)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
