# P0 route rendering audit

Baseline: `03ce02cf52b1e8ae540fa79722cd8feee21f3a99`. Dedicated branch:
`fix/p0-route-rendering`, targeting `feat/m06-api-scalability` (PR #3); PR #3
continues to target PR #2. M-02 runtime development is stopped. Existing local
operations and M-02 design notes are excluded from the repair commit.

## Inventory

There are 26 explicit route patterns and five additional admin query-string
views, plus the wildcard 404. `frontend/e2e/route-matrix.js` supplies concrete
URLs and expected headings to the Chromium suite. `routeCoverage.test.js` fails
when the actual App route patterns and matrix diverge.

All API paths below are relative to `/api/v1`. All routes use PublicLayout's
role-selected CandidateLayout, RecruiterLayout, AdminLayout or public shell;
each layout renders an Outlet. Components are named lazy exports under one
Suspense loading state. AuthProvider owns session epochs; replacement remounts
all private state. RouteGuard enforces product role; company authorization is
resolved inside recruiter screens and remains enforced by Django.

| URL pattern | Page | Access | Initial rendering APIs |
| --- | --- | --- | --- |
| `/` | JobSearchPage | public | GET jobs (filters/page) |
| `/jobs/:id` | JobDetailPage | public | GET jobs/:id |
| `/login` | LoginPage | public | none; POST auth/login on submit |
| `/admin/login` | LoginPage admin | public | none; POST auth/login on submit |
| `/register/candidate` | CandidateRegistrationPage | public | none; POST auth/candidate/register on submit |
| `/register/recruiter` | RecruiterRegistrationPage | public | none; POST auth/recruiter/register on submit |
| `/candidate` | CandidateDashboard | candidate | GET own profile/resume/skills/applications, jobs previews |
| `/candidate/profile` | ProfilePage | candidate | GET candidates/me/profile and skills |
| `/candidate/skills` | ProfilePage skillsOnly | candidate | GET candidates/me/skills |
| `/candidate/resume` | ResumePage | candidate | GET candidates/me/resume |
| `/jobs/:id/apply` | JobApplicationPage | candidate | GET jobs/:id |
| `/candidate/applications` | ApplicationsPage | candidate | GET candidates/me/applications |
| `/candidate/applications/:applicationId` | ApplicationDetailPage | candidate, own object | GET own applications/:id |
| `/recruiter` | RecruiterDashboardPage | recruiter | GET own profile/companies, selected membership/jobs/company; OWNER/ADMIN application-overview |
| `/recruiter/profile` | ProfilePage | recruiter | GET recruiters/me/profile |
| `/recruiter/companies` | CompanyDirectory | recruiter | GET recruiters/me/companies paged |
| `/recruiter/applicants` | CompanyDirectory applicants | recruiter | GET recruiters/me/companies paged |
| `/recruiter/companies/new` | CompanyPage | recruiter | no company read |
| `/recruiter/companies/:id` | CompanyPage | recruiter; OWNER/ADMIN manage, MEMBER read | GET membership/company; OWNER/ADMIN members |
| `/recruiter/jobs` | CompanyJobsPage | recruiter; active membership for private jobs | GET membership/company jobs; directory if no selection |
| `/recruiter/jobs/new` | JobEditorPage | company OWNER/ADMIN | GET membership |
| `/recruiter/jobs/:id` | RecruiterJobDetailPage | recruiter; scoped company visibility | GET membership/company jobs with exact job_id |
| `/recruiter/jobs/:id/edit` | JobEditorPage | company OWNER/ADMIN | GET membership/scoped job |
| `/recruiter/jobs/:id/applicants` | RecruiterApplicantsPage | company OWNER/ADMIN | GET membership/jobs/:id/applications |
| `/recruiter/jobs/:id/applicants/:applicationId` | RecruiterApplicantDetailPage | company OWNER/ADMIN | GET membership/scoped application |
| `/admin` | AdminPage/AdminDashboard | is_platform_admin | GET admin/overview, admin/history |
| `/admin?section=companies,recruiters,candidates,jobs,history` | AdminPage table (five views) | is_platform_admin | GET admin/overview and admin/:section |

Authenticated layouts additionally request the current profile for the header;
the recruiter shell requests membership/company discovery. Header-only failures
leave the account navigation usable. No invitation acceptance page or separate
company-role login is implemented.

## State and navigation contract

- Public lists show loading, matching records, legitimate empty results or an
  error with Retry. Details show their record or an actionable error; a missing
  object is not treated as an empty record.
- Candidate profile/skills/resume and application screens distinguish loading,
  saved records, empty skills/resume/applications and API failure. Private object
  failures do not reveal another user's data. Forms retain server field errors.
- Recruiter discovery has loading, empty memberships/search, list and Retry.
  Company job screens resolve membership before rendering; OWNER/ADMIN management
  controls are denied to MEMBER. Missing company selection is actionable.
  Company forms and job editors distinguish loading, editable/read-only data and
  load/save errors. Applicants distinguish no submissions from read failures.
- Admin dashboard shows totals and explicit unavailable/empty history; tables
  show loading, rows, no records or error. Moderation requires a reason.
- Anonymous protected access returns to login with its originating location;
  wrong product roles return to their own workspace (non-admin `/admin` returns
  to public discovery). Company management denial is a visible permission state.
  Backend authorization independently protects every private request.
- Login returns to an allowed originating path including its query/hash; direct
  authenticated login goes to the role workspace. Unknown paths retain their
  URL and provide a 404 with a recovery link. Reload is served through Vite's SPA
  fallback locally; production hosts must retain the documented SPA fallback.

## Verification and evidence

Use only `backend/.venv/bin/python backend/run_browser.py` or its concurrent
companion for browser acceptance. The runner verifies fresh digest-pinned
PostgreSQL 17.12, owns ports/services and creates synthetic route accounts after
backend tests. It never uses the development database or devjobs_test. Tokens
remain in the generated process environment and ephemeral browser contexts.
No fabricated passwords or personal information are committed.

The route matrix runs public, candidate, OWNER, ADMIN, MEMBER and platform-admin
contexts against every concrete URL, with direct navigation/reload, expected
access outcomes, meaningful content, terminated Suspense, application links and
native history where those links exist. Additional fault/navigation tests cover
malformed payloads, failures, empties, delayed responses, expiry, replacement,
unknown routes and mobile. Existing security workflows remain mandatory.
Screenshots and failure output live under the run-specific `/tmp` results path.
Exact final commands, counts, tested tree, commit and hosted CI are delivered
outside the tested tree to avoid altering the verified artifact.

## Confirmed defects and regression evidence

| Affected routes / trigger | Root cause | Repair and evidence |
| --- | --- | --- |
| Any protected login return, reproduced with `/recruiter/jobs?company=…#job-list` | Login retained only pathname; the authenticated render could also override submit navigation | Shared role-scoped destination validation in both paths retains query/hash and rejects external, encoded and dot-segment destinations. Red `devjobs-p0-login-before.log`; permanent unit and Chromium login tests. |
| `/candidate/profile` after malformed persisted auth, then `/login` submit | Session initialization rejected corrupt storage, including explicit replacement login | Explicit login repairs only the exact corrupt bytes under the existing coordination lock; peer replacement wins, including replacement between initial detection and recovery capture. Two red cases in `devjobs-p0-corrupt-before.log`; unit recovery/peer race and Chromium sign-in regression. |
| `/jobs/:id`, `/candidate`, `/recruiter/companies` with successful JSON `null` | Consumers assumed successful reads held objects/collections | GET response validation rejects invalid root values and malformed page envelopes into existing error/Retry paths. Red malformed-response cases in `devjobs-p0-routes-before-v2.log`; permanent retry scenarios and all read-route null fault coverage. |
| All routes when React render/lazy loading throws | No application error boundary | Independent root and navigation boundaries provide retry, reload and discovery. Unit tests deliberately throw, verify diagnostics omit error payload and recover after retry/navigation. |
| Unknown URLs | Wildcard redirected silently to search | URL-preserving 404 with discovery link; Chromium regression. |
| `/jobs/:id` for recruiter accounts | Ant Design 6 deprecated Alert `message` emitted console warnings | Use supported `title`; before log identifies warnings; matrix requires no unexpected console errors. |

The earlier admin/member fixture failures were test setup defects: synthetic
accounts must have active company memberships with the correct independent
company role. Non-admin `/admin` deliberately returns to public discovery;
the initial candidate redirect expectation was incorrect. Persisted auth seeding
uses the actual storage protocol so production bundles run the same assertions.
The outsider published-job preview is deliberately readable; its matrix checks the job heading and absence of management/applicant links. An initial expectation of an alert there was a harness error, confirmed by the rendered published preview. No assertions are skipped for wrong-role or outsider accounts. Unexpected React
errors fail browser acceptance; known existing Ant Design form/static-message
warnings are narrowly identified. Screenshots are failure-only; traces stay off
to avoid recording ephemeral credentials.

The production-build mode serves a freshly generated bundle with SPA fallback
from an owned test server, without development imports. It verifies bundle route
behavior, not a deployed reverse proxy; the existing deployment fallback
requirement remains. Null/root/envelope checks are intentionally structural;
other unexpected render failures are contained by the boundary. There is no new
backend API, schema, migration, dependency, JWT policy or production setting.

## Local candidate recovery — 2026-11-17

The actual development server had loaded November 9 code and ignored the newer
skills pagination parameter. Dashboard requested cursor pagination and Profile
requested page pagination, but both received HTTP 200 `[]`. Consumers read
`data.results`; the resulting undefined skills value reached render-time
`length`/collection access and triggered “This page could not be displayed”.
The shared GET validator now rejects legacy arrays when page/cursor pagination
was explicitly requested. Unpaged legacy arrays remain supported. Existing
`apiMessage` handling intentionally displays “Something went wrong. Please try
again.” with Retry / Retry skills, rather than exposing the validator exception.
Unit regressions cover both pagination modes and valid envelopes; two permanent
Chromium route regressions cover the observed array, retry and reload.

Before restart, PID 22931 was rechecked for current-user ownership, exact
`manage.py runserver 127.0.0.1:8000 --noreload` command, repository backend cwd
and its loopback listener. Only this PID received SIGTERM. Replacement PID 1510
retained the existing runtime settings, passed health HTTP 200 and owns the same
listener. No unrelated server or database process was stopped. No backend source,
API contract, migration, dependency or authentication-policy change was made.

Focused real-local Chromium used a synthetic candidate and the actual services
at ports 5173/8000. `/candidate` rendered recommendations, Profile Completion and
new-candidate empty states; `/candidate/profile` rendered Save profile and enabled
Add skill. Both passed cache-disabled CDP hard reload. Actual skills responses:

- Dashboard `?pagination=cursor&page_size=1`: object with `next`, `previous`,
  `results` array.
- Profile `?pagination=page&page=1&page_size=20`: object with `count`, `next`,
  `previous`, `results` array.

On each route, intercepted HTTP 200 `[]` produced an alert with the existing
Retry action, no render fallback, and recovery to intended content after removing
the interception and clicking Retry. Zero page exceptions; one existing Ant Design
unconnected-useForm warning during the fault scenario. Initial verification
attempts exposed overly exact accessible-name selectors (icons contribute names)
and an incorrect expectation of the validator's private error text; these test
expectations were corrected without changing the product UI.

Commands in this continuation:

- `cd frontend && npm test -- src/features/auth/validateResponse.test.js`: PASS,
  17 tests (the invocation also supplied the nonexistent candidate feature path;
  only the validator file matched).
- `cd frontend && npm test -- src/features/dashboard/CandidateDashboard.test.jsx src/features/skills/CandidateSkills.test.jsx src/features/skills/CandidateSkills.session.test.jsx`:
  PASS, 27 tests across three files.
- `python3 /tmp/devjobs-candidate-restart.py`: PASS, identity-checked restart.
- `node /tmp/devjobs-candidate-verify.cjs`: final PASS; live routes, hard reload,
  malformed success, Retry recovery. Evidence: `/tmp/devjobs-candidate-verify.log`.
- `cd frontend && npm run lint`: PASS.
- `cd frontend && npm run build`: PASS; existing >500 kB chunk advisory.
- `cd frontend && npm test`: PASS, 385 tests / 32 files; existing JSDOM
  getComputedStyle diagnostics remain.
- `git diff --check`: PASS after documentation updates.
- A redundant `npm run lint` from the repository root failed ENOENT (no root
  package.json); rerunning from `frontend/` passed after the final test edits.

The dedicated owned-runner route tests, production-bundle Chromium, exact-export
acceptance and hosted CI were not rerun for this continuation. No full backend or
database acceptance rerun was needed for unchanged backend code. These results
verify the reported local recovery, not final release/commit acceptance. No commit,
push, PR change, merge or deployment. M-02 design and unrelated operations notes
remain preserved. Temporary browser scripts/logs are local evidence, not committed
regression infrastructure. Synthetic registrations remain in the local development
database; no existing candidate data was changed.

## Candidate repair acceptance continuation

Fresh owned acceptance passes development Chromium 85/85, production-bundle
routes 75/75 and two concurrent Chromium runs 85/85 each. Both concurrent peer
checks pass. Each runner verifies PostgreSQL 17.12, applies migrations, checks
Django/migration consistency and passes 209 backend tests with eight optional
Redis skips. Owned cleanup is reported for all four runs. Frontend lint, 385
tests/32 files and build, Ruff, OpenAPI (40 paths/56 operations/negative controls),
17 runner-safety tests and whitespace checks pass. No intermittent failure or
additional source change was observed. Existing JSDOM, Ant Design and bundle
advisories remain; this is not deployment acceptance.

See P0_CANDIDATE_ACCEPTANCE_HANDOFF.md for the exact commands and focused staging
boundary. All gates must pass again against the exact staged export before commit.
Final exported/committed tree identities, counts, cleanup inventory, separate draft
PR targeting fix/p0-route-rendering and observed hosted CI results are recorded
externally at delivery to keep the verified tree unchanged. M-02 design and
unrelated operations notes remain preserved and excluded. No API, schema,
dependency, backend or authentication-policy change is included in this repair.
