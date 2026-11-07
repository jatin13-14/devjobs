import uuid

import pycountry
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Value
from django.db.models.functions import Replace

SUPPORTED_COUNTRY_CODES = tuple(sorted(country.alpha_2 for country in pycountry.countries))
SKILL_NAME_CANONICAL_PATTERN = (
    r"^[^ ]+( [^ ]+)*$"
)
SKILL_NON_ASCII_WHITESPACE = tuple(
    character
    for codepoint in range(0x3001)
    if (character := chr(codepoint)).isspace() and character != " "
)


def skill_without_non_ascii_whitespace():
    expression = models.F("name")
    for character in SKILL_NON_ASCII_WHITESPACE:
        expression = Replace(expression, Value(character), Value(""))
    return expression


def validate_iso_alpha2(value):
    if value and value not in SUPPORTED_COUNTRY_CODES:
        raise ValidationError("Enter a valid uppercase ISO 3166-1 alpha-2 country code.")


class CandidateProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="candidate_profile"
    )
    full_name = models.CharField(max_length=160)
    professional_headline = models.CharField(max_length=200, blank=True)
    country = models.CharField(
        max_length=2,
        blank=True,
        validators=[RegexValidator(r"^[A-Z]{2}$", "Enter an uppercase ISO alpha-2 country code."), validate_iso_alpha2],
    )
    city = models.CharField(max_length=100, blank=True)
    about = models.TextField(blank=True)
    years_of_experience = models.PositiveSmallIntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(80)]
    )
    current_designation = models.CharField(max_length=160, blank=True)
    portfolio_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = (
            models.CheckConstraint(
                condition=models.Q(years_of_experience__gte=0),
                name="candidates_profile_experience_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(country="") | models.Q(country__in=SUPPORTED_COUNTRY_CODES),
                name="candidates_profile_country_alpha2",
            ),
        )
        indexes = (models.Index(fields=["country", "city"], name="cand_profile_location_idx"),)

    def clean(self):
        super().clean()
        if self.user_id and self.user.role != self.user.Role.CANDIDATE:
            raise ValidationError({"user": "Candidate profiles require a candidate account."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.full_name


class Skill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class CanonicalQuerySet(models.QuerySet):
        def bulk_create(self, objs, **kwargs):
            for obj in objs:
                obj.name = " ".join(obj.name.split()).lower()
            return super().bulk_create(objs, **kwargs)

        def bulk_update(self, objs, fields, **kwargs):
            if "name" in fields:
                for obj in objs:
                    obj.name = " ".join(obj.name.split()).lower()
            return super().bulk_update(objs, fields, **kwargs)

        def update(self, **kwargs):
            if isinstance(kwargs.get("name"), str):
                kwargs["name"] = " ".join(kwargs["name"].split()).lower()
            return super().update(**kwargs)

    objects = CanonicalQuerySet.as_manager()

    class Meta:
        ordering = ("name",)
        constraints = (
            models.CheckConstraint(
                condition=models.Q(name=models.functions.Lower("name"))
                & models.Q(name__regex=SKILL_NAME_CANONICAL_PATTERN)
                & models.Q(name=skill_without_non_ascii_whitespace()),
                name="candidates_skill_name_canonical",
            ),
        )

    def save(self, *args, **kwargs):
        normalized = " ".join(self.name.split()).lower()
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and normalized != self.name and "name" not in update_fields:
            raise ValueError("Skill name changed but is not included in update_fields.")
        self.name = normalized
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class CandidateSkill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    candidate = models.ForeignKey(
        CandidateProfile, on_delete=models.CASCADE, related_name="candidate_skills"
    )
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name="candidate_skills")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = (
            models.UniqueConstraint(
                fields=["candidate", "skill"], name="candidates_candidate_skill_uniq"
            ),
        )
        indexes = (models.Index(fields=["skill", "candidate"], name="cand_skill_reverse_idx"),)


class CandidateResume(models.Model):
    candidate = models.OneToOneField(
        CandidateProfile, primary_key=True, on_delete=models.CASCADE, related_name="resume"
    )
    storage_key = models.CharField(max_length=40, unique=True, editable=False)
    size = models.PositiveIntegerField()
    updated_at = models.DateTimeField(auto_now=True)
