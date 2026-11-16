"""Transactional candidate profile operations."""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.candidates.models import CandidateSkill, Skill


@transaction.atomic
def add_candidate_skill(*, candidate, name):
    try:
        with transaction.atomic():
            skill, _ = Skill.objects.get_or_create(name=name)
    except ValidationError as error:
        # Model validation can observe the winner after get_or_create's initial
        # lookup missed it. Django retries IntegrityError, but not ValidationError.
        errors = getattr(error, "error_dict", {})
        if set(errors) != {"name"} or any(item.code != "unique" for item in errors["name"]):
            raise
        skill = Skill.objects.filter(name=name).first()
        if skill is None:
            raise
    return CandidateSkill.objects.get_or_create(candidate=candidate, skill=skill)
