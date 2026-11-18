import uuid

from django.conf import settings
from django.db import models


class ModerationEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    administrator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    target_type = models.CharField(
        max_length=10, choices=[(v, v) for v in ("companies", "users", "jobs")]
    )
    target_id = models.UUIDField()
    action = models.CharField(max_length=12)
    reason = models.CharField(max_length=2000)
    previous_state = models.BooleanField()
    new_state = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = (
            models.Index(
                fields=["target_type", "target_id", "created_at"], name="moderation_target_idx"
            ),
        )
