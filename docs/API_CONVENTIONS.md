# API conventions

## Base path
Use `/api/v1/` for versioned application endpoints.

## Naming and methods
- Collection resources are plural nouns.
- `GET` reads; `POST` creates/actions; `PATCH` partial updates; `PUT` full replacement only where needed; `DELETE` removes where product rules permit.
- Use consistent trailing-slash behavior across the API.
- Return appropriate HTTP status codes and stable error shapes.

## Proposed endpoint map
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register/` | Register |
| POST | `/api/v1/auth/token/` | Obtain JWT |
| POST | `/api/v1/auth/token/refresh/` | Refresh JWT |
| GET/PATCH | `/api/v1/candidates/me/profile/` | Candidate profile |
| GET/POST | `/api/v1/candidates/me/skills/` | Read/add candidate skills |
| DELETE | `/api/v1/candidates/me/skills/{skill_id}/` | Remove own skill |
| GET/PATCH | `/api/v1/recruiters/me/profile/` | Recruiter profile |
| POST | `/api/v1/jobs/` | Create a draft job |
| GET | `/api/v1/jobs/` | Search published jobs |
| GET/PATCH | `/api/v1/jobs/{job_id}/` | Read a public job or manage an authorized job |
| POST | `/api/v1/jobs/{job_id}/publish/` | Publish a draft job |
| POST | `/api/v1/jobs/{job_id}/close/` | Close a job |
| GET | `/api/v1/companies/{company_id}/jobs/` | List public or member-visible company jobs |
| POST | `/api/v1/companies/` | Create a company |
| GET/PATCH | `/api/v1/companies/{id}/` | Company detail/update |
| GET/POST | `/api/v1/jobs/` | Search/create jobs |
| GET/PATCH | `/api/v1/jobs/{id}/` | Job detail/update |
| POST | `/api/v1/jobs/{id}/publish/` | Publish job |
| POST | `/api/v1/jobs/{id}/close/` | Close job |
| POST | `/api/v1/jobs/{job_id}/applications/` | Apply for a published job |
| GET | `/api/v1/candidates/me/applications/` | List own applications |
| GET/PATCH | `/api/v1/candidates/me/applications/{application_id}/` | Retrieve or withdraw own application |
| GET | `/api/v1/jobs/{job_id}/applications/` | List applicants for an authorized company job |
| GET | `/api/v1/jobs/{job_id}/applications/{application_id}/` | Retrieve an authorized applicant |
| PATCH | `/api/v1/jobs/{job_id}/applications/{application_id}/status/` | Update applicant status |

## List behavior
- Paginate all potentially large collections.
- Document filter names, allowed values and default ordering.
- Validate page size and impose a maximum.
- Return total count and next/previous navigation consistently.

## Error shape
Use one documented error format, for example:
```json
{
  "detail": "Human-readable summary",
  "code": "stable_machine_code",
  "fields": {
    "email": ["Enter a valid email address."]
  }
}
```

## Authentication

### `POST /api/v1/auth/candidate/register/`

Creates a candidate account and its required candidate profile. The profile's minimum required field is `full_name`.

```json
{
  "email": "candidate@example.test",
  "password": "Synthetic-Only-Password-42!",
  "full_name": "Documentation Candidate"
}
```

### `POST /api/v1/auth/recruiter/register/`

Creates a recruiter account and its required recruiter profile. The profile's minimum required field is the recruiter's full name, sent as `name`.

```json
{
  "email": "recruiter@example.test",
  "password": "Synthetic-Only-Password-42!",
  "name": "Documentation Recruiter"
}
```

Both registration endpoints return `201 Created` with safe account fields only:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "email": "candidate@example.test",
  "role": "candidate"
}
```

The server assigns the role; submitted role or privilege fields are ignored. Email is trimmed and lowercased by the account's canonical identity rules. Weak passwords, invalid input, and duplicate canonical emails return `400` field errors. Registration is atomic across the account and profile.

### `POST /api/v1/auth/login/` and `/api/v1/auth/token/`

The login route and existing token route accept canonical email credentials. `/token/` remains available for compatibility. A successful response includes JWTs and safe user identity:

```json
{
  "refresh": "<synthetic-refresh-token>",
  "access": "<synthetic-access-token>",
  "user": {
    "id": "00000000-0000-4000-8000-000000000001",
    "email": "candidate@example.test",
    "role": "candidate"
  }
}
```

Invalid credentials use the same generic `401` response regardless of whether the email exists. Anonymous issuance retains the configured `JWT_TOKEN_RATE` throttle (default `5/minute`).

### `POST /api/v1/auth/token/refresh/`

Accepts `{ "refresh": "<synthetic-refresh-token>" }` and returns a new access token (and a rotated refresh token only when rotation is enabled in settings).

## Profiles and candidate skills

All profile routes require a valid JWT. Candidate routes require role `candidate`; recruiter routes require role `recruiter`. Admin accounts are denied. Ownership is derived from the authenticated account, and profile identifiers, account identifiers, roles, credentials, and timestamps cannot be written through these endpoints. Partial changes use `PATCH`; unknown or protected fields return `400` field errors.

### Candidate profile

`GET` and `PATCH /api/v1/candidates/me/profile/` read or partially update the authenticated candidate's profile. Editable fields are `full_name`, `professional_headline`, `country`, `city`, `about`, `years_of_experience`, `current_designation`, `portfolio_url`, `github_url`, and `linkedin_url`.

```json
{ "professional_headline": "Backend engineer", "country": "IN", "years_of_experience": 5 }
```

Responses include profile `id`, the public profile fields, and timestamps; they do not include account credentials or ownership identifiers.

### Candidate skills

`GET /api/v1/candidates/me/skills/` returns an array of the candidate's skills. `POST` accepts `{ "name": "  PYTHON   Developer " }`; names are trimmed, internal whitespace is collapsed, and letters are lowercased. An existing canonical skill is reused. The first association returns `201 Created`; repeating the same association returns `200 OK` without creating duplicates. `DELETE /api/v1/candidates/me/skills/{skill_id}/` removes only the authenticated candidate's association and returns `204`; a skill not associated with that candidate returns `404`.

Example skill response:

```json
[{ "id": "00000000-0000-4000-8000-000000000002", "name": "python developer" }]
```

### Recruiter profile

`GET` and `PATCH /api/v1/recruiters/me/profile/` read or partially update the authenticated recruiter's own profile. Editable fields are `name`, `designation`, `work_email`, and `phone`. Company creation and membership are not part of these routes.

`GET /api/v1/recruiters/me/companies/` returns a simple array for the authenticated recruiter, derived only from `request.user`. Each item contains the company `id` and `name`, `membership_id`, and active membership `role` (`OWNER`, `ADMIN`, or `MEMBER`). Inactive and suspended memberships are omitted. Recruiters with no active memberships receive `200 []`. Candidate and anonymous requests are denied; no account IDs or private company/contact fields are returned.

## Companies and recruiter membership

`POST /api/v1/companies/` requires an authenticated recruiter with a recruiter profile. It accepts `name`, `website`, `description`, `industry`, `company_size`, `headquarters_country`, and `headquarters_city`. The server atomically creates the company and the caller's first `OWNER`/`ACTIVE` membership. Ownership, membership, and private logo storage fields are never writable through the company serializer. The response contains the public company representation and the creator's safe membership representation.

`GET /api/v1/companies/{company_id}/` is public and returns public profile fields. `PATCH` requires an active `OWNER` or `ADMIN` membership. Member lists (`GET/POST /api/v1/companies/{company_id}/members/`) and membership changes (`PATCH/DELETE /api/v1/companies/{company_id}/members/{membership_id}/`) require the same permission. Member representations include only account ID and recruiter display name; work email and phone are not exposed.

Adding a member accepts `recruiter_id` (the recruiter's account UUID), optional `role` (`ADMIN` or `MEMBER`, default `MEMBER`), and optional `status` (default `INVITED`). The target must have an active recruiter account and recruiter profile, and duplicate or self assignments are rejected. The creator cannot assign a new owner; ownership changes use `PATCH` with `{"role":"OWNER"}` and call the existing atomic ownership-transfer service, which demotes the former owner to admin. Status changes accept `INVITED`, `ACTIVE`, or `SUSPENDED`. The active owner cannot be suspended or removed; transfer ownership first. Membership IDs are scoped to the URL company, preventing cross-company access. A company retains exactly one active owner, enforced by the service and PostgreSQL constraints/triggers.

| Operation | Recruiter with no membership | Active MEMBER | Active ADMIN | Active OWNER |
|---|---:|---:|---:|---:|
| Public company GET | Allow | Allow | Allow | Allow |
| Company PATCH | Deny | Deny | Allow | Allow |
| List/add/change/remove members | Deny | Deny | Allow | Allow |

Candidates and admin-role accounts cannot create companies or manage recruiter membership. Unauthenticated users may read public company details.

## Jobs

`POST /api/v1/jobs/` accepts `company_id`, `title`, `description`, `employment_type` (`FULL_TIME`, `PART_TIME`, `CONTRACT`, `TEMPORARY`, `INTERNSHIP`), `workplace_type` (`REMOTE`, `HYBRID`, `ON_SITE`), `experience_level` (`ENTRY`, `MID`, `SENIOR`, `LEAD`), and optional location, country, skills, salary bounds/currency, and application deadline. New jobs are always `DRAFT`; creator, status, publication time, and timestamps are server controlled. Skills are canonicalized using the candidate skill rules. Countries are uppercase ISO alpha-2 and salary currencies are uppercase ISO 4217 codes. If either salary bound is provided, a currency is required; minimum cannot exceed maximum.

Only active recruiter accounts with an active `OWNER` or `ADMIN` membership can create, edit, publish, or close jobs. Active `MEMBER` accounts cannot manage jobs and see only public postings; no member-level job permissions are defined in the current membership rules. Company IDs are authorized from membership, job company ownership cannot be changed, and recruiter/owner IDs are never writable. A closed job cannot be republished.

`GET /api/v1/jobs/` supports `search` (title/description), `country`, `location`, `workplace_type`, `employment_type`, `experience_level`, `skill`, `company`, `page`, and `page_size` (default 20, maximum 100). Results use the standard count/next/previous/results page response. Public listing and detail include published jobs whose application deadline is absent or has not passed. `GET /api/v1/companies/{company_id}/jobs/` shows all company jobs to active OWNER/ADMIN members; everyone else sees only public jobs. Company and recruiter responses omit private contact and storage fields.

## Frontend authentication integration
- The frontend uses the same login and registration paths above. Candidate registration sends `full_name`; recruiter registration must send `name`, because the required recruiter profile cannot be created without it. The frontend labels this field as the recruiter's name and collects no company details.
- The browser stores access and refresh tokens plus only the safe `id`, `email`, and `role` identity in `localStorage`. This persists login across reloads but means an XSS vulnerability could expose bearer tokens. Production should pair this with a strict CSP and XSS prevention; moving refresh tokens to HttpOnly secure cookies would require a backend cookie/CSRF design change.
- Authenticated Axios requests attach the access token. On a `401`, one shared refresh request serves concurrent failures; delayed failures use a newer access token already stored by another request instead of refreshing again. Each original request is retried at most once, and auth endpoints are excluded from retry. Invalid/expired refresh tokens clear local auth state and dispatch logout. A refresh completing after logout or an account switch cannot restore the previous credentials.

## API compatibility
- Avoid breaking response changes within a version.
- Add fields compatibly where possible.
- Breaking changes require a new API version or an explicit migration plan.
- Keep the reviewed OpenAPI contract in [`openapi.yaml`](openapi.yaml) synchronized with implemented endpoints.

## Applications

`POST /api/v1/jobs/{job_id}/applications/` requires a candidate account with a candidate profile and accepts only an optional `cover_letter` (up to 5,000 characters). Candidate identity is derived from the JWT. Only published jobs whose deadline is absent or not before the current product date accept applications. A database unique constraint permits one application per candidate/job pair; concurrent duplicates return `400`.

Candidates list and retrieve only their applications. `PATCH /api/v1/candidates/me/applications/{application_id}/` accepts an empty object to withdraw; other fields are rejected. Withdrawal is allowed from `SUBMITTED`, `REVIEWING`, or `SHORTLISTED` and is terminal.

Recruiter applicant endpoints require an active recruiter profile and active `OWNER` or `ADMIN` membership for the job's company. They are scoped to the job in the URL, so a foreign application ID returns `404`. Applicant data includes the candidate's name, headline, location, experience, designation and skills; it excludes email, phone, profile/account IDs and private storage references. The additive top-level `resume_available` boolean indicates whether a current resume can be requested through this application (withdrawn applications and inactive candidates return false).

Status lifecycle: `SUBMITTED` may move to `REVIEWING`, `SHORTLISTED`, or `REJECTED`; `REVIEWING` may move to `SHORTLISTED` or `REJECTED`; `SHORTLISTED` may move to `REJECTED`. Candidates may withdraw nonterminal applications. `REJECTED` and `WITHDRAWN` are terminal. Every status change is recorded in application status history. Applying does not require a resume. Private resume access is documented below.

### Candidate frontend integration
- Public discovery uses `GET /api/v1/jobs/` with a 300 ms debounced query and the documented `search`, `country`, `location`, `workplace_type`, `employment_type`, `experience_level`, `skill`, `company`, and `page` parameters. The UI consumes the standard `count`/`results` page response and job `company` object (`id`, `name`); company filtering therefore submits the company UUID.
- Job details use `GET /api/v1/jobs/{job_id}/`. Anonymous Apply navigation returns to the application route after login; `RouteGuard` limits submission and application views to candidates. Recruiters receive no candidate Apply action.
- Application submission, listing, detail, and withdrawal use the candidate endpoints above. API errors from field-level `job` responses are shown inline for duplicate and closed/expired jobs. Withdrawal is offered only for `SUBMITTED`, `REVIEWING`, or `SHORTLISTED`, matching the server lifecycle.

### Recruiter frontend integration
- Recruiter pages use `/recruiters/me/profile/`, `/recruiters/me/companies/`, `/companies/{company_id}/jobs/`, job create/edit/publish/close endpoints, and the job-scoped applicant list/detail/status endpoints. Applicant displays consume only the privacy-safe `candidate` object returned by the API and expose only lifecycle-valid transitions.
- The workspace automatically selects a sole active company, otherwise lets the recruiter choose by company name and role. The selected company remains in the existing URL query state; changing it reloads company jobs. The dashboard hides create controls unless the membership role is `OWNER` or `ADMIN`. Backend permissions remain authoritative. The public job detail GET hides drafts; recruiter detail loads draft details from the company jobs collection.

## Private resumes

- `GET /api/v1/candidates/me/resume/` returns `{"resume": null}` or metadata (`filename: resume.pdf`, `content_type: application/pdf`, `size`, `updated_at`).
- `PUT` to the same endpoint accepts multipart `file` only and creates/replaces the current resume. Exactly one file is required. Default maximum: 5 MiB (`RESUME_MAX_BYTES`). Actual PDF structure is parsed with strict pypdf; empty, malformed, truncated, encrypted and zero-page PDFs are rejected with `400`. Client MIME/filename are not trusted or retained. Valid PDF bytes with an arbitrary filename/MIME are accepted. No text extraction or rendering occurs.
- `DELETE` to the same endpoint is idempotent (`204`). Candidate role and own profile are required for all three operations.
- `GET /api/v1/candidates/me/resume/download/` serves only the caller's resume.
- `GET /api/v1/jobs/{job_id}/applications/{application_id}/resume/` rechecks active recruiter account and active OWNER/ADMIN company membership, scopes the application to that job, and serves the candidate's **current** resume. MEMBER, invited/suspended/removed memberships, other companies, candidate callers and anonymous callers are denied. There is no candidate-ID download API or public media URL.
- Withdrawal and candidate deactivation revoke recruiter downloads (`404`). Job closure/deadline expiry and rejection retain access to support existing hiring records; membership suspension/removal/demotion revokes it immediately for subsequent requests. Deletion revokes all subsequent downloads; replacement changes what every eligible application serves. Other non-withdrawn applications can still grant access. An already authorized/open response cannot be recalled.
- Downloads return an attachment with a fixed safe filename, `application/pdf`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and sandbox CSP. Missing files or invalid stored keys return generic `404`; no storage paths, original filenames or storage keys are serialized. Storage/database write failures return generic `503`.
- Authenticated browser downloads use the existing JWT/refresh Axios client with blob responses and short-lived browser object URLs. Tokens never enter download URLs. The candidate resume page supports status, upload, replacement, download and removal; applicant detail shows download only when `resume_available` is true. The server always reauthorizes download even if the page is stale.

## Platform administration and moderation

`/api/v1/admin/overview/` returns resource counts. GET `/api/v1/admin/{companies|recruiters|candidates|jobs}/` lists records using `search`, `state=active|restricted`, `page`, `page_size` (20 default, 100 max); jobs also accept `status`. GET the UUID detail route to inspect; POST the same detail route with `{action, reason}` to moderate. Actions are suspend/reactivate for companies/accounts and hide/restore for jobs. Reasons are required, trimmed, nonblank and at most 2000 characters. Unknown fields are rejected. Repeated decisions return 400 without another event.

GET `/api/v1/admin/history/` returns paginated events (administrator UUID, target type/UUID, action, reason, previous/new boolean state, timestamp), filterable by `target_type=companies|users|jobs`, `target_id`, and `action`. No update/delete endpoint exists; PostgreSQL rejects event UPDATE/DELETE. Decisions and events commit atomically under target locks. Company locks serialize job moderation/publication and application submission; jobs are reread after acquiring the lock.

Authorization requires a current active Django staff or superuser account; the product admin role alone grants nothing. Login identity adds read-only `is_platform_admin` for navigation; every backend request checks the database identity. Public registration ignores privilege fields and profile updates reject them. Company OWNER/ADMIN membership grants no platform rights. Admin workspace is `/admin`; credentials remain in the existing JWT client. No admin resume download permission is introduced.

Policy: account suspension sets existing `is_active=False`, rejecting login and existing access tokens on subsequent authenticated requests. All protected candidate functionality, including own resume and withdrawal, is unavailable while suspended. Historical applications and documents remain intact. Company suspension blocks management, membership changes, applicant/resume access and public job discovery/applications. Memberships and owner invariants are retained. Job holds independently block public discovery, new applications, editing and publishing; restore clears only the hold and retains lifecycle status/deadline. Restoration may make a previously published eligible job visible again. Job holds alone do not revoke authorized historical applicant/resume access. Candidate suspension revokes recruiter resume downloads; existing cross-company and withdrawal restrictions remain. In-flight requests/streams authorized before suspension may finish; bytes already downloaded cannot be recalled. Reactivation restores eligibility, subject to all other guards.

Reasons/history are private administrative information and must not include secrets or unnecessary personal data. API serializers never expose audit reasons, suspension flags, credential fields or storage references through ordinary user APIs. Administrator identities cannot be suspended through these moderation endpoints; use the controlled operational process.

## Operational probes

`GET /api/v1/health/` remains public dependency-free liveness. `GET /api/v1/ready/` is public aggregate readiness: PostgreSQL query, cache round-trip and private storage write/read/delete. Returns 200 `{"status":"ready"}` or 503 `{"status":"unavailable"}` with no-store; no dependency details. Both ignore bearer headers; protected routes retain their existing authentication and moderation checks.

### Workflow UI completion (2026-11-07)
Candidate profile and own skills use the existing `/candidates/me/profile/` and
`/candidates/me/skills/` contracts; resume management remains a separate screen.
Recruiter profiles use `/recruiters/me/profile/`. Company create/edit and membership
screens use the existing company endpoints. Membership UI never offers OWNER assignment,
owner removal or changes to the signed-in recruiter's own membership. Server authorization
continues to decide every operation; MEMBER cannot edit company details or list/manage members.

Company jobs retain `{count,next,previous,results}` pagination. The company jobs screen
sends `page` and optional `status` (DRAFT/PUBLISHED/CLOSED); status is applied after the
existing visibility restrictions. Changing status or company resets the page, clears old
results and reloads. Recruiter dashboard counts traverse all company job pages. The
recruiter's active-company discovery endpoint retains its existing complete array response.
No schema changes or incompatible response changes were introduced.
