from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.recruiters.models import RecruiterProfile

from .models import CompanyMembership
from .services import create_company


class CompanyApiTests(APITestCase):
    def make_user(self, local_part, role=User.Role.RECRUITER):
        user = User.objects.create_user(f"{local_part}@example.test", password="Synthetic-pass-123!", role=role)
        if role == User.Role.RECRUITER:
            RecruiterProfile.objects.create(user=user, name=f"Synthetic {local_part.title()}")
        return user

    def setUp(self):
        self.owner_user = self.make_user("owner")
        self.owner_profile = self.owner_user.recruiter_profile
        self.company = create_company(recruiter=self.owner_profile, name="Synthetic API Labs")
        self.owner_membership = CompanyMembership.objects.get(company=self.company)
        self.admin_user = self.make_user("admin")
        self.admin = CompanyMembership.objects.create(
            company=self.company, recruiter=self.admin_user.recruiter_profile,
            role=CompanyMembership.Role.ADMIN, status=CompanyMembership.Status.ACTIVE,
        )
        self.member_user = self.make_user("member")
        self.member = CompanyMembership.objects.create(
            company=self.company, recruiter=self.member_user.recruiter_profile,
            role=CompanyMembership.Role.MEMBER, status=CompanyMembership.Status.ACTIVE,
        )

    def test_recruiter_creation_assigns_owner_and_blocks_membership_mass_assignment(self):
        self.client.force_authenticate(self.make_user("creator"))
        response = self.client.post("/api/v1/companies/", {
            "name": "Synthetic Created Co", "headquarters_country": "IN",
            "role": "MEMBER", "status": "INVITED", "owner_id": str(self.owner_user.pk),
        }, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post("/api/v1/companies/", {"name": "Synthetic Created Co"}, format="json")
        self.assertEqual(response.status_code, 201)
        membership = CompanyMembership.objects.get(company_id=response.data["company"]["id"])
        self.assertEqual(membership.recruiter.user_id, self.client.handler._force_user.pk)
        self.assertEqual((membership.role, membership.status), ("OWNER", "ACTIVE"))
        self.assertNotIn("logo", response.data["company"])

    def test_candidate_cannot_create_company(self):
        self.client.force_authenticate(self.make_user("candidate", User.Role.CANDIDATE))
        response = self.client.post("/api/v1/companies/", {"name": "Synthetic Candidate Co"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_public_read_and_owner_admin_member_update_permissions(self):
        response = self.client.get(f"/api/v1/companies/{self.company.pk}/")
        self.assertEqual(response.status_code, 200)
        self.client.force_authenticate(self.member_user)
        response = self.client.patch(f"/api/v1/companies/{self.company.pk}/", {"name": "Changed"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(self.admin_user)
        response = self.client.patch(f"/api/v1/companies/{self.company.pk}/", {"name": "Synthetic Updated"}, format="json")
        self.assertEqual(response.status_code, 200)
        response = self.client.patch(f"/api/v1/companies/{self.company.pk}/", {"owner_id": str(self.member_user.pk)}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_membership_add_rejects_candidate_duplicate_and_self_assignment(self):
        self.client.force_authenticate(self.owner_user)
        candidate = self.make_user("applicant", User.Role.CANDIDATE)
        response = self.client.post(f"/api/v1/companies/{self.company.pk}/members/", {"recruiter_id": str(candidate.pk)}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post(f"/api/v1/companies/{self.company.pk}/members/", {"recruiter_id": str(self.admin_user.pk)}, format="json")
        self.assertEqual(response.status_code, 400)
        invitee = self.make_user("invitee")
        response = self.client.post(f"/api/v1/companies/{self.company.pk}/members/", {"recruiter_id": str(invitee.pk), "role": "MEMBER"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "INVITED")

    def test_admin_can_manage_members_and_active_member_cannot(self):
        members_url = f"/api/v1/companies/{self.company.pk}/members/"
        self.client.force_authenticate(self.member_user)
        self.assertEqual(self.client.get(members_url).status_code, 403)
        self.client.force_authenticate(self.admin_user)
        self.assertEqual(self.client.get(members_url).status_code, 200)
        response = self.client.patch(
            f"{members_url}{self.member.pk}/", {"status": "SUSPENDED"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SUSPENDED")

    def test_member_cross_company_access_and_owner_transfer_guards(self):
        other = self.make_user("otherowner")
        other_company = create_company(recruiter=other.recruiter_profile, name="Synthetic Other Labs")
        foreign = CompanyMembership.objects.get(company=other_company)
        self.client.force_authenticate(self.owner_user)
        response = self.client.patch(
            f"/api/v1/companies/{self.company.pk}/members/{foreign.pk}/",
            {"status": "SUSPENDED"}, format="json",
        )
        self.assertEqual(response.status_code, 404)
        response = self.client.patch(
            f"/api/v1/companies/{self.company.pk}/members/{self.owner_membership.pk}/",
            {"status": "SUSPENDED"}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        response = self.client.delete(f"/api/v1/companies/{self.company.pk}/members/{self.owner_membership.pk}/")
        self.assertEqual(response.status_code, 400)
        response = self.client.patch(
            f"/api/v1/companies/{self.company.pk}/members/{self.member.pk}/",
            {"role": "OWNER"}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.owner_membership.refresh_from_db()
        self.assertEqual(self.owner_membership.role, CompanyMembership.Role.ADMIN)
        self.assertEqual(CompanyMembership.objects.filter(company=self.company, role="OWNER", status="ACTIVE").count(), 1)
