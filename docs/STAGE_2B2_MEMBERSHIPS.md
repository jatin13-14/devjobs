# Stage 2B.2 secure company membership management

The original regression demonstrated ADMIN self-promotion through generic PATCH.
The API correctly delegated OWNER assignment to the ownership service, but that
service incorrectly included ADMIN in its allowed actor roles. The repair removes
ADMIN from that service boundary. It preserves the original failing regression,
all API payloads, database constraints, transaction boundaries and supported
nonownership operations. No second transfer implementation was added.

Security review traced CompanyCollectionView/create_company (initial owner),
CompanyMembersView/add_membership (ADMIN/MEMBER only),
CompanyMemberDetailView/transfer_ownership (OWNER only), set_membership_role
(rejects OWNER assignment and active-owner demotion), set_membership_status and
remove_membership (preserve active owner). Serializer unknown-field validation
blocks ownership mass assignment on company creation/update. Django admin has no
registered company mutation interface. Moderation suspends companies/accounts;
it does not assign membership ownership. Database direct deletion and duplicate
owner regressions retain integrity protections. Company deletion is not a public
membership operation. Authorization is checked again after the company lock;
concurrent transfers from the same old OWNER admit only one winner.

CompanyPage reuses React, Ant Design, Axios, canonical auth and
useCompanyMembership. It supports bounded member pages, creation for an existing
recruiter account ID, roles, statuses, removal confirmation and OWNER-only
transfer confirmation. The previous owner is shown as ADMIN after revalidation.
Private management is unavailable to MEMBER. Loading/error/empty states, retry,
account/company remount isolation and membership/page callback guards are retained.
Self-management of nonowners follows the backend contract. The server validates
transfer eligibility including the target account's active recruiter status;
the member response does not expose target account activation state.

No email invitations, acceptance tokens, delivery, account provisioning or
private read-only MEMBER list were added. M-06 remains open. Chromium and native
Web Locks are the browser boundary. Optional Redis tests may skip. Already-sent
server effects cannot be revoked. Normal edits retain last-write semantics;
this is bounded regression coverage, not exhaustive concurrency certification.

The exact staged-tree identity and eventual local commit identity are recorded
in the delivery report and an external acceptance manifest, avoiding changes to
the tested tree after export. No push, merge, deployment or PR modification is
authorized. Unrelated operations notes remain in the working tree and outside
the index. Stage 2B.3 is outside this change.

Additional review found retained page callbacks could revive after returning to
the same numeric page, and queued membership requests lacked editor authority at
transport dispatch. Distinct action identities now retire on membership/page
changes, and mutations supply the existing Axios dispatch/retry authority hook.
A failing regression demonstrated the missing hook before repair. These checks
complement canonical session ownership and server-side membership authorization;
they cannot revoke effects of requests already dispatched.

The transfer button uses a short visible label and a target-specific accessible
name. Chromium checks the new owner's membership screen at 390px for overflow
and verifies keyboard focus on the transfer action before completing the round trip.
