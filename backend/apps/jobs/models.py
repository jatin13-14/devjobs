import uuid

import pycountry
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from apps.candidates.models import SUPPORTED_COUNTRY_CODES, Skill, validate_iso_alpha2

SUPPORTED_CURRENCIES = tuple(sorted(currency.alpha_3 for currency in pycountry.currencies))


class Job(models.Model):
    class EmploymentType(models.TextChoices):
        FULL_TIME = "FULL_TIME", "Full time"
        PART_TIME = "PART_TIME", "Part time"
        CONTRACT = "CONTRACT", "Contract"
        TEMPORARY = "TEMPORARY", "Temporary"
        INTERNSHIP = "INTERNSHIP", "Internship"

    class WorkplaceType(models.TextChoices):
        REMOTE = "REMOTE", "Remote"
        HYBRID = "HYBRID", "Hybrid"
        ON_SITE = "ON_SITE", "On-site"

    class ExperienceLevel(models.TextChoices):
        ENTRY = "ENTRY", "Entry"
        MID = "MID", "Mid"
        SENIOR = "SENIOR", "Senior"
        LEAD = "LEAD", "Lead"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"
        CLOSED = "CLOSED", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="jobs")
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_jobs"
    )
    is_hidden = models.BooleanField(default=False)
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=20000)
    employment_type = models.CharField(max_length=12, choices=EmploymentType.choices)
    workplace_type = models.CharField(max_length=10, choices=WorkplaceType.choices)
    location = models.CharField(max_length=160, blank=True)
    country = models.CharField(
        max_length=2, blank=True, validators=[RegexValidator(r"^[A-Z]{2}$"), validate_iso_alpha2]
    )
    experience_level = models.CharField(max_length=10, choices=ExperienceLevel.choices)
    skills = models.ManyToManyField(Skill, through="JobSkill", related_name="jobs", blank=True)
    salary_min = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    salary_max = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    salary_currency = models.CharField(
        max_length=3, blank=True, validators=[RegexValidator(r"^[A-Z]{3}$")]
    )
    application_deadline = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-published_at", "-created_at", "id")
        indexes = (
            models.Index(
                fields=("status", "country", "workplace_type"), name="jobs_public_filter_idx"
            ),
            models.Index(fields=("company", "status"), name="jobs_company_status_idx"),
        )
        constraints = (
            models.CheckConstraint(
                condition=models.Q(country="") | models.Q(country__in=SUPPORTED_COUNTRY_CODES),
                name="jobs_country_alpha2",
            ),
            models.CheckConstraint(
                condition=models.Q(salary_min__isnull=True)
                | models.Q(salary_max__isnull=True)
                | models.Q(salary_min__lte=models.F("salary_max")),
                name="jobs_salary_range_valid",
            ),
        )

    def clean(self):
        super().clean()
        errors = {}
        if (
            self.salary_min is not None or self.salary_max is not None
        ) and not self.salary_currency:
            errors["salary_currency"] = "A currency is required when a salary is provided."
        if self.salary_currency and self.salary_currency not in SUPPORTED_CURRENCIES:
            errors["salary_currency"] = "Enter a valid uppercase ISO 4217 currency code."
        if (
            self.workplace_type == self.WorkplaceType.REMOTE
            and not self.location
            and not self.country
        ):
            pass
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class JobSkill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    skill = models.ForeignKey(Skill, on_delete=models.PROTECT)

    class Meta:
        constraints = (
            models.UniqueConstraint(fields=("job", "skill"), name="jobs_job_skill_unique"),
        )
