import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class RecruiterProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recruiter_profile"
    )
    name = models.CharField(max_length=160)
    designation = models.CharField(max_length=160, blank=True)
    work_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        if self.user_id and self.user.role != self.user.Role.RECRUITER:
            raise ValidationError({"user": "Recruiter profiles require a recruiter account."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name
