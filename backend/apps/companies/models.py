import uuid

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models

from apps.candidates.models import SUPPORTED_COUNTRY_CODES


def validate_iso_alpha2(value):
    if value and value not in SUPPORTED_COUNTRY_CODES:
        raise ValidationError("Enter a valid uppercase ISO 3166-1 alpha-2 country code.")

class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    is_suspended = models.BooleanField(default=False)
    name = models.CharField(max_length=200)
    website = models.URLField(blank=True)
    description = models.TextField(blank=True)
    industry = models.CharField(max_length=100, blank=True)
    company_size = models.CharField(max_length=30, blank=True)
    headquarters_country = models.CharField(
        max_length=2,
        blank=True,
        validators=[RegexValidator(r"^[A-Z]{2}$", "Enter an uppercase ISO alpha-2 country code."), validate_iso_alpha2],
    )
    headquarters_city = models.CharField(max_length=100, blank=True)
    logo = models.CharField(
        max_length=500, blank=True, help_text="Private storage reference; not a public URL."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = (models.Index(fields=["name"], name="companies_name_idx"),)
        constraints = (
            models.CheckConstraint(
                condition=models.Q(headquarters_country="")
                | models.Q(headquarters_country__in=SUPPORTED_COUNTRY_CODES),
                name="companies_hq_country_alpha2",
            ),
        )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class CompanyMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        ADMIN = "ADMIN", "Admin"
        MEMBER = "MEMBER", "Member"

    class Status(models.TextChoices):
        INVITED = "INVITED", "Invited"
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recruiter = models.ForeignKey(
        "recruiters.RecruiterProfile", on_delete=models.CASCADE, related_name="company_memberships"
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.INVITED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = (
            models.UniqueConstraint(
                fields=["recruiter", "company"], name="companies_membership_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(role__in=["OWNER", "ADMIN", "MEMBER"]),
                name="companies_membership_role_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=["INVITED", "ACTIVE", "SUSPENDED"]),
                name="companies_membership_status_valid",
            ),
            models.UniqueConstraint(
                fields=["company"],
                condition=models.Q(role="OWNER", status="ACTIVE"),
                name="companies_one_active_owner",
            ),
        )
        indexes = (models.Index(fields=["company", "status", "role"], name="co_member_access_idx"),)
