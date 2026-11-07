import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase

from apps.accounts.models import User
from apps.recruiters.models import RecruiterProfile

from .models import Company, CompanyMembership
from .services import (
    InvalidMembershipTransition,
    create_company,
    remove_membership,
    set_membership_status,
    transfer_ownership,
)


class CompanyModelTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(
            "recruiter@example.test", password="Test-pass-123", role=User.Role.RECRUITER
        )
        self.recruiter = RecruiterProfile.objects.create(user=user, name="Test Recruiter")
        self.company = Company.objects.create(name="Synthetic Test Labs")
        CompanyMembership.objects.create(
            recruiter=self.recruiter, company=self.company,
            role=CompanyMembership.Role.OWNER, status=CompanyMembership.Status.ACTIVE,
        )

    def test_company_and_membership_use_uuids(self):
        membership = CompanyMembership.objects.get(recruiter=self.recruiter, company=self.company)
        self.assertIsInstance(self.company.pk, uuid.UUID)
        self.assertIsInstance(membership.pk, uuid.UUID)

    def test_database_rejects_company_without_owner_at_commit(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Company.objects.create(name="Synthetic Ownerless Co")
            with connection.cursor() as cursor:
                cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")

    def test_country_database_constraint_rejects_unknown_code(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Company.objects.filter(pk=self.company.pk).update(headquarters_country="ZZ")

    def test_company_membership_is_unique_per_recruiter(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            CompanyMembership.objects.create(recruiter=self.recruiter, company=self.company)

    def test_membership_roles_and_statuses_are_database_constrained(self):
        other_user = User.objects.create_user(
            "other-recruiter@example.test", password="Test-pass-123", role=User.Role.RECRUITER
        )
        other_recruiter = RecruiterProfile.objects.create(user=other_user, name="Other Recruiter")
        for role in CompanyMembership.Role.values:
            with self.subTest(role=role):
                membership = CompanyMembership.objects.create(
                    recruiter=other_recruiter, company=self.company, role=role
                )
                membership.delete()
        for status in CompanyMembership.Status.values:
            with self.subTest(status=status):
                membership = CompanyMembership.objects.create(
                    recruiter=other_recruiter, company=self.company, status=status
                )
                membership.delete()
        membership = CompanyMembership.objects.create(
            recruiter=other_recruiter, company=self.company
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            CompanyMembership.objects.filter(pk=membership.pk).update(role="INVALID")
        with self.assertRaises(IntegrityError), transaction.atomic():
            CompanyMembership.objects.filter(pk=membership.pk).update(status="INVALID")


class CompanyOwnershipServiceTests(TestCase):
    def setUp(self):
        self.owner = self.make_recruiter("owner")
        self.admin = self.make_recruiter("admin")
        self.member = self.make_recruiter("member")
        self.company = create_company(recruiter=self.owner, name="Synthetic Ownership Labs")
        self.owner_membership = CompanyMembership.objects.get(company=self.company, recruiter=self.owner)
        self.admin_membership = CompanyMembership.objects.create(
            company=self.company, recruiter=self.admin,
            role=CompanyMembership.Role.ADMIN, status=CompanyMembership.Status.ACTIVE,
        )
        self.member_membership = CompanyMembership.objects.create(
            company=self.company, recruiter=self.member,
            role=CompanyMembership.Role.MEMBER, status=CompanyMembership.Status.ACTIVE,
        )

    @staticmethod
    def make_recruiter(local_part):
        user = User.objects.create_user(
            f"{local_part}@example.test", password="Test-pass-123", role=User.Role.RECRUITER
        )
        return RecruiterProfile.objects.create(user=user, name=f"Synthetic {local_part.title()}")

    def test_company_creation_assigns_first_active_owner(self):
        company = create_company(recruiter=self.make_recruiter("founder"), name="Synthetic New Co")
        membership = CompanyMembership.objects.get(company=company)
        self.assertEqual((membership.role, membership.status), ("OWNER", "ACTIVE"))

    def test_company_creation_rolls_back_when_owner_creation_fails(self):
        with (
            patch("apps.companies.services.CompanyMembership.objects.create", side_effect=RuntimeError),
            self.assertRaises(RuntimeError),
        ):
            create_company(recruiter=self.make_recruiter("rollback"), name="Synthetic Rollback Co")
        self.assertFalse(Company.objects.filter(name="Synthetic Rollback Co").exists())

    def test_database_rejects_duplicate_active_owner(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            CompanyMembership.objects.filter(pk=self.member_membership.pk).update(
                role=CompanyMembership.Role.OWNER, status=CompanyMembership.Status.ACTIVE
            )

    def test_transfer_promotes_member_and_demotes_previous_owner(self):
        result = transfer_ownership(actor=self.owner, company_id=self.company.pk, new_owner=self.member)
        self.owner_membership.refresh_from_db()
        self.assertEqual(result.role, CompanyMembership.Role.OWNER)
        self.assertEqual((self.owner_membership.role, self.owner_membership.status), ("ADMIN", "ACTIVE"))

    def test_transfer_rolls_back_if_new_owner_update_fails(self):
        target_id = self.member_membership.pk
        save = CompanyMembership.save

        def fail_after_target_save(membership, *args, **kwargs):
            result = save(membership, *args, **kwargs)
            if membership.pk == target_id and membership.role == CompanyMembership.Role.OWNER:
                raise RuntimeError("synthetic transfer failure")
            return result

        with (
            patch.object(CompanyMembership, "save", new=fail_after_target_save),
            self.assertRaisesMessage(RuntimeError, "synthetic transfer failure"),
        ):
            transfer_ownership(
                actor=self.owner, company_id=self.company.pk, new_owner=self.member
            )
        self.owner_membership.refresh_from_db()
        self.member_membership.refresh_from_db()
        self.assertEqual(self.owner_membership.role, CompanyMembership.Role.OWNER)
        self.assertEqual(self.member_membership.role, CompanyMembership.Role.MEMBER)

    def test_transfer_to_nonmember_invited_or_suspended_member_is_rejected(self):
        outsider = self.make_recruiter("outsider")
        with self.assertRaises(InvalidMembershipTransition):
            transfer_ownership(actor=self.owner, company_id=self.company.pk, new_owner=outsider)
        invited = self.make_recruiter("invited")
        CompanyMembership.objects.create(company=self.company, recruiter=invited)
        with self.assertRaises(InvalidMembershipTransition):
            transfer_ownership(actor=self.owner, company_id=self.company.pk, new_owner=invited)
        self.member_membership.status = CompanyMembership.Status.SUSPENDED
        self.member_membership.save(update_fields=["status"])
        with self.assertRaises(InvalidMembershipTransition):
            transfer_ownership(actor=self.owner, company_id=self.company.pk, new_owner=self.member)

    def test_only_owner_cannot_be_suspended_or_removed(self):
        with self.assertRaises(InvalidMembershipTransition):
            set_membership_status(actor=self.owner, membership_id=self.owner_membership.pk,
                                  status=CompanyMembership.Status.SUSPENDED)
        with self.assertRaises(InvalidMembershipTransition):
            remove_membership(actor=self.owner, membership_id=self.owner_membership.pk)

    def test_transfer_can_suspend_previous_owner_atomically(self):
        transfer_ownership(actor=self.owner, company_id=self.company.pk, new_owner=self.member,
                           previous_owner_status=CompanyMembership.Status.SUSPENDED)
        self.owner_membership.refresh_from_db()
        self.assertEqual((self.owner_membership.role, self.owner_membership.status), ("ADMIN", "SUSPENDED"))
        self.assertEqual(CompanyMembership.objects.filter(
            company=self.company, role="OWNER", status="ACTIVE"
        ).count(), 1)

    def test_invited_or_suspended_admin_cannot_manage_company(self):
        for status in (CompanyMembership.Status.INVITED, CompanyMembership.Status.SUSPENDED):
            self.admin_membership.status = status
            self.admin_membership.save(update_fields=["status"])
            with self.assertRaises(PermissionDenied):
                set_membership_status(actor=self.admin, membership_id=self.member_membership.pk,
                                      status=CompanyMembership.Status.SUSPENDED)
        self.admin_membership.status = CompanyMembership.Status.ACTIVE
        self.admin_membership.save(update_fields=["status"])

    def test_regular_member_cannot_manage_memberships_or_transfer(self):
        with self.assertRaises(PermissionDenied):
            set_membership_status(actor=self.member, membership_id=self.admin_membership.pk,
                                  status=CompanyMembership.Status.SUSPENDED)
        with self.assertRaises(PermissionDenied):
            transfer_ownership(actor=self.member, company_id=self.company.pk, new_owner=self.admin)

    def test_admin_can_manage_membership_and_nonowner_removal(self):
        set_membership_status(actor=self.admin, membership_id=self.member_membership.pk,
                              status=CompanyMembership.Status.SUSPENDED)
        self.member_membership.refresh_from_db()
        self.assertEqual(self.member_membership.status, CompanyMembership.Status.SUSPENDED)
        remove_membership(actor=self.admin, membership_id=self.member_membership.pk)
        self.assertFalse(CompanyMembership.objects.filter(pk=self.member_membership.pk).exists())

    def test_admin_can_activate_invited_member(self):
        invitee = self.make_recruiter("invitee")
        membership = CompanyMembership.objects.create(company=self.company, recruiter=invitee)
        set_membership_status(
            actor=self.admin, membership_id=membership.pk, status=CompanyMembership.Status.ACTIVE
        )
        membership.refresh_from_db()
        self.assertEqual(membership.status, CompanyMembership.Status.ACTIVE)

    def test_inactive_recruiter_cannot_manage_company(self):
        self.admin.user.is_active = False
        self.admin.user.save(update_fields=["is_active"])
        with self.assertRaises(PermissionDenied):
            set_membership_status(
                actor=self.admin,
                membership_id=self.member_membership.pk,
                status=CompanyMembership.Status.SUSPENDED,
            )

    def test_rejected_status_change_leaves_membership_unchanged(self):
        with self.assertRaises(InvalidMembershipTransition):
            set_membership_status(
                actor=self.admin,
                membership_id=self.owner_membership.pk,
                status=CompanyMembership.Status.SUSPENDED,
            )
        self.owner_membership.refresh_from_db()
        self.assertEqual(self.owner_membership.status, CompanyMembership.Status.ACTIVE)

    def test_owner_user_delete_and_membership_delete_are_database_blocked(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.owner.user.delete()
            with connection.cursor() as cursor:
                cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.owner_membership.delete()
            with connection.cursor() as cursor:
                cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")

    def test_membership_id_from_another_company_is_not_authorized(self):
        other_owner = self.make_recruiter("otherowner")
        other_company = create_company(recruiter=other_owner, name="Synthetic Other Co")
        other_member = self.make_recruiter("othermember")
        foreign_membership = CompanyMembership.objects.create(
            company=other_company, recruiter=other_member,
            role=CompanyMembership.Role.MEMBER, status=CompanyMembership.Status.ACTIVE,
        )
        with self.assertRaises(PermissionDenied):
            remove_membership(actor=self.owner, membership_id=foreign_membership.pk)


class CompanyOwnershipConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.owner = CompanyOwnershipServiceTests.make_recruiter("concurrentowner")
        self.targets = [
            CompanyOwnershipServiceTests.make_recruiter("concurrentone"),
            CompanyOwnershipServiceTests.make_recruiter("concurrenttwo"),
        ]
        self.admin = CompanyOwnershipServiceTests.make_recruiter("concurrentadmin")
        self.company = create_company(recruiter=self.owner, name="Synthetic Concurrent Co")
        CompanyMembership.objects.create(
            company=self.company, recruiter=self.admin,
            role=CompanyMembership.Role.ADMIN, status=CompanyMembership.Status.ACTIVE,
        )
        for target in self.targets:
            CompanyMembership.objects.create(
                company=self.company, recruiter=target,
                role=CompanyMembership.Role.MEMBER, status=CompanyMembership.Status.ACTIVE,
            )

    def test_concurrent_transfers_leave_exactly_one_active_owner(self):
        owner_id, company_id = self.owner.pk, self.company.pk
        target_ids = [target.pk for target in self.targets]

        def transfer(target_id):
            close_old_connections()
            try:
                actor = RecruiterProfile.objects.get(pk=owner_id)
                target = RecruiterProfile.objects.get(pk=target_id)
                return transfer_ownership(actor=actor, company_id=company_id, new_owner=target).pk
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(transfer, target_ids))
        self.assertEqual(len(results), 2)
        self.assertEqual(
            CompanyMembership.objects.filter(
                company=self.company, role="OWNER", status="ACTIVE"
            ).count(),
            1,
        )

    def test_concurrent_owner_suspension_and_removal_are_rejected(self):
        owner_membership_id = CompanyMembership.objects.get(
            company=self.company, recruiter=self.owner
        ).pk
        actor_id = self.admin.pk

        def attempt(action):
            close_old_connections()
            try:
                actor = RecruiterProfile.objects.get(pk=actor_id)
                if action == "suspend":
                    set_membership_status(
                        actor=actor,
                        membership_id=owner_membership_id,
                        status=CompanyMembership.Status.SUSPENDED,
                    )
                else:
                    remove_membership(actor=actor, membership_id=owner_membership_id)
                return "unexpected-success"
            except InvalidMembershipTransition:
                return "rejected"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(attempt, ("suspend", "remove")))
        self.assertEqual(results, ["rejected", "rejected"])
        self.assertEqual(
            CompanyMembership.objects.filter(
                pk=owner_membership_id, role="OWNER", status="ACTIVE"
            ).count(),
            1,
        )
