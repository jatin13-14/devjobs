from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction

from apps.recruiters.models import RecruiterProfile

from .models import Company, CompanyMembership


class InvalidMembershipTransition(ValidationError):
    """Raised when a membership change would violate company ownership rules."""


def _active_recruiter(recruiter):
    if not recruiter.user.is_active or recruiter.user.role != recruiter.user.Role.RECRUITER:
        raise PermissionDenied("An active recruiter account is required.")


def _authorize_locked(*, recruiter, company_id, allowed_roles):
    _active_recruiter(recruiter)
    if Company.objects.filter(pk=company_id, is_suspended=True).exists():
        raise PermissionDenied("Company is suspended.")
    try:
        return CompanyMembership.objects.select_for_update().get(
            recruiter=recruiter,
            company_id=company_id,
            status=CompanyMembership.Status.ACTIVE,
            role__in=allowed_roles,
        )
    except CompanyMembership.DoesNotExist as exc:
        raise PermissionDenied("An active company owner or admin membership is required.") from exc


def _require_active_owner(company_id):
    if not CompanyMembership.objects.filter(
        company_id=company_id,
        role=CompanyMembership.Role.OWNER,
        status=CompanyMembership.Status.ACTIVE,
    ).exists():
        raise InvalidMembershipTransition("A company must retain an active owner.")


@transaction.atomic
def create_company(*, recruiter: RecruiterProfile, **company_fields):
    _active_recruiter(recruiter)
    company = Company.objects.create(**company_fields)
    CompanyMembership.objects.create(
        company=company,
        recruiter=recruiter,
        role=CompanyMembership.Role.OWNER,
        status=CompanyMembership.Status.ACTIVE,
    )
    return company


@transaction.atomic
def add_membership(*, actor: RecruiterProfile, company_id, recruiter: RecruiterProfile,
                   role=CompanyMembership.Role.MEMBER,
                   status=CompanyMembership.Status.INVITED):
    company = Company.objects.select_for_update().get(pk=company_id)
    _authorize_locked(
        recruiter=actor,
        company_id=company.pk,
        allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN],
    )
    _active_recruiter(recruiter)
    if recruiter.pk == actor.pk:
        raise InvalidMembershipTransition("You cannot assign a membership to yourself.")
    if role not in (CompanyMembership.Role.ADMIN, CompanyMembership.Role.MEMBER):
        raise InvalidMembershipTransition("New memberships cannot be assigned the owner role.")
    if status not in CompanyMembership.Status.values:
        raise InvalidMembershipTransition("Invalid membership status.")
    if CompanyMembership.objects.filter(company=company, recruiter=recruiter).exists():
        raise InvalidMembershipTransition("This recruiter already has a company membership.")
    return CompanyMembership.objects.create(
        company=company, recruiter=recruiter, role=role, status=status
    )


@transaction.atomic
def transfer_ownership(*, actor: RecruiterProfile, company_id, new_owner: RecruiterProfile,
                       previous_owner_status=CompanyMembership.Status.ACTIVE):
    company = Company.objects.select_for_update().get(pk=company_id)
    _authorize_locked(
        recruiter=actor,
        company_id=company.pk,
        allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN],
    )
    _active_recruiter(new_owner)
    memberships = CompanyMembership.objects.select_for_update().filter(company=company)
    current = memberships.filter(
        role=CompanyMembership.Role.OWNER, status=CompanyMembership.Status.ACTIVE
    ).first()
    target = memberships.filter(recruiter=new_owner).first()
    if current is None or target is None or target.status != CompanyMembership.Status.ACTIVE:
        raise InvalidMembershipTransition("The new owner must be an active member of this company.")
    if current.pk == target.pk:
        raise InvalidMembershipTransition("The selected member is already the active owner.")
    if previous_owner_status not in CompanyMembership.Status.values:
        raise InvalidMembershipTransition("Invalid previous-owner membership status.")

    current.role = CompanyMembership.Role.ADMIN
    current.status = previous_owner_status
    current.save(update_fields=["role", "status", "updated_at"])
    target.role = CompanyMembership.Role.OWNER
    target.save(update_fields=["role", "updated_at"])
    _require_active_owner(company.pk)
    return target


@transaction.atomic
def set_membership_status(*, actor: RecruiterProfile, membership_id, status):
    membership = CompanyMembership.objects.select_related("company").get(pk=membership_id)
    Company.objects.select_for_update().get(pk=membership.company_id)
    _authorize_locked(
        recruiter=actor,
        company_id=membership.company_id,
        allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN],
    )
    membership = CompanyMembership.objects.select_for_update().get(pk=membership_id)
    if status not in CompanyMembership.Status.values:
        raise InvalidMembershipTransition("Invalid membership status.")
    if (membership.role == CompanyMembership.Role.OWNER
            and membership.status == CompanyMembership.Status.ACTIVE
            and status != CompanyMembership.Status.ACTIVE):
        raise InvalidMembershipTransition("Transfer ownership before suspending the active owner.")
    membership.status = status
    membership.save(update_fields=["status", "updated_at"])
    _require_active_owner(membership.company_id)
    return membership


@transaction.atomic
def set_membership_role(*, actor: RecruiterProfile, membership_id, role):
    membership = CompanyMembership.objects.select_related("company").get(pk=membership_id)
    Company.objects.select_for_update().get(pk=membership.company_id)
    _authorize_locked(
        recruiter=actor,
        company_id=membership.company_id,
        allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN],
    )
    membership = CompanyMembership.objects.select_for_update().get(pk=membership_id)
    if role not in CompanyMembership.Role.values:
        raise InvalidMembershipTransition("Invalid membership role.")
    if membership.role == CompanyMembership.Role.OWNER and membership.status == CompanyMembership.Status.ACTIVE:
        raise InvalidMembershipTransition("Transfer ownership before changing the active owner's role.")
    if role == CompanyMembership.Role.OWNER:
        raise InvalidMembershipTransition("Use ownership transfer to assign the owner role.")
    membership.role = role
    membership.save(update_fields=["role", "updated_at"])
    _require_active_owner(membership.company_id)
    return membership


@transaction.atomic
def remove_membership(*, actor: RecruiterProfile, membership_id):
    membership = CompanyMembership.objects.select_related("company").get(pk=membership_id)
    Company.objects.select_for_update().get(pk=membership.company_id)
    _authorize_locked(
        recruiter=actor,
        company_id=membership.company_id,
        allowed_roles=[CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN],
    )
    membership = CompanyMembership.objects.select_for_update().get(pk=membership_id)
    if membership.role == CompanyMembership.Role.OWNER and membership.status == CompanyMembership.Status.ACTIVE:
        raise InvalidMembershipTransition("Transfer ownership before removing the active owner.")
    membership.delete()
    _require_active_owner(membership.company_id)


def authorize_company_operation(*, recruiter, company_id, allowed_roles):
    """Return a membership only for active recruiter accounts and memberships."""
    _active_recruiter(recruiter)
    if Company.objects.filter(pk=company_id, is_suspended=True).exists():
        raise PermissionDenied("Company is suspended.")
    try:
        return CompanyMembership.objects.get(
            recruiter=recruiter,
            company_id=company_id,
            status=CompanyMembership.Status.ACTIVE,
            role__in=allowed_roles,
        )
    except CompanyMembership.DoesNotExist as exc:
        raise PermissionDenied("An active company owner or admin membership is required.") from exc
