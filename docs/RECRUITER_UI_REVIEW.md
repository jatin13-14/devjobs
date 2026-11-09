# Recruiter reference implementation — 2026-11-08

## Reference and interpretation

The supplied `DevJobs Recruiter Workspace UI Mockup.png` is the visual source.
The requested ChatGPT shared link returned a fetch/cache failure; the attached
image already supplies desktop/mobile light/dark screenshots, so no substitute
design was used. There were no dedicated job, applicant, company or profile
screenshots. Those routes inherit the recruiter shell and Ant Design tokens.

Desktop composition: deep green fixed sidebar with code wordmark, recruiter badge,
Dashboard/Jobs/Applicants/Company/Team/Analytics navigation and company identity;
compact search/theme/account header; welcome and posting action; four tinted
metrics; chart and recent applicants side by side; narrower company/quick-action
column on the right. Sidebar is 220px (180px below 1200px), header 78px, content
padding 28px, right column 280px (320px on large screens). Cards use 12–13px radii,
subtle borders/shadows, bold compact headings and restrained emerald accents.

Light surfaces are white on near-white with mint, blue, amber and purple metric
backgrounds. Dark surfaces use #071b1e/#152a30 with brighter mint actions and muted
blue-gray borders. The sidebar stays deep green in both themes. Ant Design uses a
separate ConfigProvider, including its dark algorithm. Recruiter preference uses
`devjobs.recruiter.theme`; Candidate preference and components are untouched.

Mobile composition: compact brand/theme/account header, welcome text, Post a Job
and Review Applicants actions, 2×2 metrics, recent applicants first, and five fixed
bottom destinations (Dashboard, Jobs, Applicants, Company, Profile). Chart and
company/quick-action panels remain available farther down the page. Navigation
includes safe-area padding; mobile buttons/links use at least 44px touch height.

Tablet breakpoints (900px bottom navigation, 1200px single lower-panel column),
extra mobile content below recent applicants, exact full-browser dimensions,
and internal-page layouts are inferred responsive adaptations: the mockup is a
composite, not a set of full-size browser screenshots with measured breakpoints.
No pixel-perfect claim or automated pixel-difference score is made.

## Files and behavior

- `frontend/src/components/templates/RecruiterLayout.jsx`: dedicated shell,
  role identity, company identity, isolated persistent themes and navigation.
- `frontend/src/styles/recruiter.css`: role-scoped reference styling and responsive
  layout; Candidate/Admin selectors are not changed.
- `frontend/src/components/templates/PublicLayout.jsx`: recruiter-only branch.
- `frontend/src/features/jobs/components/RecruiterOverview.jsx`: dashboard cards,
  daily chart, recent applicants, company overview and supported quick actions.
- `frontend/src/features/jobs/services/recruiterOverview.js`: complete applicant
  pagination across authorized company jobs, ordering and daily/status aggregation.
- `frontend/src/features/jobs/pages/RecruiterPages.jsx`: dashboard integration and
  URL-backed search initialization, preserving job/detail/editor/applicant workflows.
- `frontend/src/features/jobs/pages/CompanyDirectory.jsx`: preserves job search
  while selecting a company.
- Recruiter page tests updated; overview aggregation and layout/theme tests added.

No new dependencies, backend/API/schema/authentication/environment changes or
record mutations. Existing backend authorization remains authoritative.
OWNER/ADMIN can access applicant aggregation and management actions. MEMBER does
not fetch applicants and has no posting/company-edit/team-invitation controls.

## Data semantics and supported differences

All identity, company, jobs and applicant values come from existing APIs. The
previous demo data snapshot was not assumed to be current. Active Jobs means the
count of PUBLISHED company jobs (not a new backend expiry/lifecycle definition).
Total Applicants counts applications, including terminal statuses. New Applicants
means current SUBMITTED status; In Review means REVIEWING. The chart counts
`applied_at` by local calendar day over the last seven days, including terminal
applications. Recent applicants are sorted by `applied_at` across all job pages.

The chart retains real zero values and never draws the mockup's invented trend.
Missing permissions/data show an unavailable state rather than zero. Company
metadata errors do not erase successfully loaded application data. Application
load failures have Retry activity. Server-fetched initials replace unavailable
profile/company image assets. Long names/headlines wrap safely.

There is no notification API or notification workflow: no inert bell was added.
Search covers supported company job search, not an invented cross-resource search.
Team opens the existing company/membership selection workflow; Invite Team Member
opens the existing authorized company membership form. Analytics navigates to the
dashboard's real application chart; no new analytics product or endpoint was added.
The seven-day caption is a fixed reporting window, not an inert dropdown.

## Verification

Final commands and results are recorded after browser completion below.

Screenshots remain local, outside source control because they contain current
account/profile data. All nine viewport sizes have light/dark dashboard captures:
1440×900, 1600×900, 1920×1080, 768×1024, 1024×768, 320×700, 375×812,
390×844 and 430×932. Files: `/tmp/devjobs-recruiter-{width}-{light|dark}.png`.

Representative captures:
- Desktop light: `/tmp/devjobs-recruiter-1440-light.png`
- Desktop dark: `/tmp/devjobs-recruiter-1440-dark.png`
- Mobile light: `/tmp/devjobs-recruiter-390-light.png`
- Mobile dark: `/tmp/devjobs-recruiter-390-dark.png`

Visual inspection compared these captures with the supplied composite. Main
hierarchy, panel order, sidebar, tinted metrics, right rail, theme identity and
mobile bottom navigation follow the reference. Differences: actual names/counts,
actual chart shape, initials rather than portraits, omitted unsupported bell,
functional Team/Analytics shortcuts, extra mobile panels below the reference's
visible content, and inferred dimensions/breakpoints. The mockup's font and icon
source assets are unavailable; existing project fonts/Ant Design icons are used.

Large companies require traversing every authorized job/application page. Requests
are sequential to avoid bursts, but there is no server aggregate endpoint/cache;
this can be slow at scale. No backend infrastructure was added for this UI task.
Mutation-based browser tests are excluded by the user's explicit database rule.

### Final verification results

From `frontend/`:

| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm test` | PASS — 53 tests, 16 files |
| `npm run build` | PASS — existing shared chunk-size advisory remains |

From repository root:

| Command | Result |
| --- | --- |
| `git diff --check` | PASS |
| `git status --short` | Reviewed; 6 modified tracked paths / 7 untracked paths |
| `git diff --cached --stat` | Empty index |

Vitest retains existing non-failing JSDOM pseudo-element `getComputedStyle`
diagnostics from Ant Design. Initial root-directory npm invocations failed because
package.json belongs to frontend; the corrected frontend commands above passed.
Initial tests exposed auto-company-selection timing and dropdown initial visibility;
the assertions now wait for settled state. Browser inspection caught an invisible
account-menu motion state; explicit recruiter `motion: false` fixed it. Final unit
coverage includes visible logout menu, isolated theme storage, MEMBER restrictions,
pagination, status counts, terminal application activity and genuine zero responses.

Read-only browser command: `node /tmp/devjobs-recruiter-audit.cjs` (host permission
needed for Chromium; the sandbox launch was denied by macOS). Final run verified:

- Both themes at all nine requested dashboard viewports: 18 captures, no horizontal
  overflow; theme survives reload.
- Company/job/applicant directories, recruiter profile, company details/memberships,
  all three existing job detail/edit/applicant-list routes, and new-job form.
- Existing applicant detail, including candidate skills display. Resume download
  was not exercised; no resume data was created.
- Recruiter routes at all nine widths without document overflow.
- Mobile dashboard navigation, visible account menu/logout, and anonymous recruiter
  route redirect after logout.
- Candidate login and profile, skills, resume and applications routes; recruiter
  layout absent from Candidate.

The final combined script exited 1 at subsequent Admin login with HTTP 429.
It did not complete a new Admin regression pass in that run. The focused command
`node /tmp/devjobs-recruiter-menu-debug.cjs` had already exited 0 with Candidate and
Admin login and all five Admin sections (companies, recruiters, candidates, jobs,
history) passing, with zero uncaught page errors and zero recruiter API errors.
That focused run preceded the recruiter-only motion fix. Admin code/styles were
not changed. No more login attempts were made after the later 429. These are
separate results, not a claim that the final combined browser command passed.

Visual comparison was manual against the supplied mockup; no image-difference
metric is reported. Dashboard data was current server data, not fixtures. Browser
checks submitted no job, company, profile, membership, application, moderation or
upload mutation. Mutation E2E suite and backend/database tests were not run.
Status transitions and saves retain existing implementations and unit coverage;
their live mutation success is outside this read-only verification.

### Working tree and delivery boundary

HEAD remains `84b338125f20b4903eebf2b921a318bb046715c5` on the existing
`feat/private-candidate-resumes` branch. No branch/index/commit/history/PR/deployment
operation was performed. The original modifications to `PROJECT_STATUS.md` and
`docs/LOCAL_DEVELOPMENT.md` were preserved. This task only appends its own status
entry to PROJECT_STATUS; local-development documentation is unchanged by this task.
There are four changed tracked frontend files and six new frontend files plus
this review document. Screenshots and browser helpers stay in /tmp, outside Git.
No changes to `backend/config/settings/prod.py` or other backend files.

## Final audit — 2026-11-09

Finalization scope: retained the existing reference design and frontend contracts.
Baseline HEAD was `84b338125f20b4903eebf2b921a318bb046715c5`; created focused
branch `feat/recruiter-workspace-final`. Initial inventory independently confirmed
six modified tracked files, seven untracked files and an empty index.

### Findings and validation

- Verified defect: mobile account button measured 40×44px. Added `min-width: 44px`
  to recruiter account styling. No redesign or unrelated refactor.
- Added focused tests for local-midnight boundaries across month changes, exclusion
  of activity outside the seven-day window, and rejection of incomplete API page
  results. Existing tests cover pagination, status grouping, real zero activity,
  role controls, session expiration/refresh, and Candidate/Admin integration.
- Aggregation counts all company job pages; PUBLISHED alone is active, DRAFT/CLOSED
  are excluded. Each application belongs to one job; total means applications,
  not distinct people. SUBMITTED and REVIEWING are current-status counts; daily
  chart includes all statuses by submission date. Calendar arithmetic uses local
  midnight and next local midnight (including varying day lengths), with an
  injectable clock. No fake trend or partial successful total is substituted for
  failed application loading. Stable backend ordering is `-applied_at, id`.
- Sequential page reads are not a transactional snapshot: concurrent inserts can
  shift offset pages. Large-company performance and cross-page concurrency remain
  existing API limitations; no backend contract or infrastructure change.
- Reference URL was retried and returned fetch/cache failure. No original mockup
  image was found in accessible attachments. All four named prior captures exist;
  desktop/mobile light/dark captures were inspected, and fresh captures were made.
  Current composition, typography, spacing, chart, cards and navigation were
  checked for coherence; a fresh original-reference comparison is **unavailable**.
  Prior reference comparison above remains historical, not independently repeated.
- `node /tmp/devjobs-recruiter-final-audit.cjs`: PASS. Both themes at all nine
  specified sizes (18 captures), no dashboard horizontal overflow, persistent
  theme, all recruiter directories/profile/company/membership views, all three
  live job detail/edit/applicant lists, create form and existing applicant detail.
  Mobile navigation, logout and anonymous protected-route redirect passed.
  Candidate profile/skills/resume/applications and Admin all five resource
  sections passed. Zero uncaught page errors or API errors. Data writes blocked
  by request interception; only authentication POSTs permitted.
- `node /tmp/devjobs-recruiter-touch.cjs`: PASS for read-only navigation; measured
  the 40px account button before correction. Its abbreviated viewport loop logs
  the inherited “18” caption, but only 390×844 was tested by that focused command.
- Prior Admin HTTP 429 evidence and default shared anonymous 5/minute throttle
  are consistent with expected IP-based throttling across roles. Fresh one-login-
  per-role audit succeeded without 429; no cache or security settings changed.
  No deliberate throttling reproduction was performed.
- Mutation E2E and backend suites SKIPPED: existing tooling is pinned to the
  protected devjobs_test endpoint and no authorized disposable isolation exists.
  No databases created, migrated or modified. Browser checks do not submit job,
  company, application, profile, membership, upload or moderation mutations.
  Status transitions/resume download retain existing code; live mutation success
  and unavailable resume download are not certified by this read-only audit.

### Commit isolation

Full-file recruiter boundary: four modified frontend integration/test files,
six new frontend files, and this review. PROJECT_STATUS is staged from HEAD plus
only the recruiter implementation/final-audit sections. The older local readiness,
account provisioning and cleanup notes stay outside the index; all 160 added
LOCAL_DEVELOPMENT lines remain uncommitted. No Candidate-only, backend, production
settings, API/schema/auth changes, dependencies, environment files, screenshots,
credentials or build output belong to this commit.

Exact authorized paths:

```
PROJECT_STATUS.md
docs/RECRUITER_UI_REVIEW.md
frontend/src/components/templates/PublicLayout.jsx
frontend/src/components/templates/RecruiterLayout.jsx
frontend/src/components/templates/RecruiterLayout.test.jsx
frontend/src/features/jobs/components/RecruiterOverview.jsx
frontend/src/features/jobs/pages/CompanyDirectory.jsx
frontend/src/features/jobs/pages/RecruiterPages.jsx
frontend/src/features/jobs/pages/RecruiterPages.test.jsx
frontend/src/features/jobs/services/recruiterOverview.js
frontend/src/features/jobs/services/recruiterOverview.test.js
frontend/src/styles/recruiter.css
```

Working-tree commands from frontend: `npm run lint`, `npm test` (55 tests / 16
files), `npm run build`: PASS. Root `git diff --check`: PASS. Existing non-failing
JSDOM diagnostics and 751.31 kB shared chunk advisory remain; no speculative bundle
refactor. The first CSS-edit command used an incorrect frontend-relative path;
corrected root-path edit succeeded. Sandbox localhost/Chromium/Git operations
required host permission; permitted reruns succeeded.

Independent staged-snapshot verification and final delivery results follow below.

### Independent snapshot and final verdict

**PASS for audited local recruiter delivery, subject to the verification limits
above.** Admin UI redesign may start as a separate authorized task; it was not
started here. No production or mutation-E2E certification is implied.

Export command: `git checkout-index --all --prefix=/tmp/devjobs-recruiter-index-m195s_dq/`.
All 12 selected paths matched index blobs byte-for-byte. Existing node_modules
was symlinked into the export; no new dependency installation was performed.
From the exported frontend, `npm run lint`, `npm test` (55 tests / 16 files), and
`npm run build` all PASS. Logs: `/tmp/devjobs-recruiter-index-{lint,test,build}.log`.
The shared bundle is 751.31 kB / 245.07 kB gzip; advisory only.

`node /tmp/devjobs-recruiter-staged-audit.cjs`: PASS against the independent export
on port 5175. Browser-only API proxy supplies the existing allowed origin and
CORS response for that temporary port; no backend settings change. Requests
block data mutations, allowing only login/refresh authentication POSTs.

- Both themes at all nine requested recruiter sizes PASS, no document overflow.
  Dashboard/header buttons and bottom-nav links meet 44px in both dimensions,
  including the corrected account button. Fresh screenshot capture waits for the
  actual loaded chart. All recruiter routes also pass all nine widths.
- Dashboard metrics match independent read-only API totals for published jobs,
  all applications, SUBMITTED and REVIEWING. Actual applicant detail, job/create/
  edit forms, company details/memberships/profile and mobile navigation pass.
- Candidate login/dashboard, profile/skills/resume/applications, all live job
  details, job search, both themes, mobile navigation and logout PASS.
- Admin login/dashboard, all five sections, navigation and logout PASS.
- Recruiter reload/session persistence, logout and anonymous guard PASS. Expired
  access/failed-refresh behavior is verified by the shared auth unit tests;
  no live token clock or security setting was changed.
- Zero uncaught browser errors or recruiter API errors; no HTTP 429. No repeated
  login attempts to exhaust the throttle.

Complete staged source/diff and exact 12-path allowlist reviewed. Credential/
private-key pattern scan PASS (synthetic test identities only). Both
`git diff --cached --check` and `git diff --check` PASS. Independent frontend
source bytes match index and working tree; final documentation-only additions
are exported again and compared before commit. The single authorized local
commit uses `feat(recruiter): finalize responsive recruiter workspace`.
Only the 59 pre-existing operations lines in PROJECT_STATUS and 160 lines in
LOCAL_DEVELOPMENT remain outside that boundary. No push, merge, deployment or
PR #1 modification. An initial root-directory build invocation failed ENOENT;
the corrected frontend commands and independent-export commands above passed.
