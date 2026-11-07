# Release readiness review — 2026-11-07

Verdict: **PASS WITH BLOCKERS**. Local implementation/checks pass; this is not approval to deploy or a claim that all browser MVP paths are complete.

## Changes and important files

- `backend/config/settings/production_validation.py`, `prod.py`: production requires explicit PostgreSQL, strong signing secret, explicit allowed hosts and shared Redis configuration; validates HTTPS origins, strict booleans, redirect/edge enforcement and HSTS combinations. Secure cookies/headers remain enforced. Proxy trust remains explicit. No production SQLite fallback. Invalid configuration fails startup; dependency availability is now readiness rather than network I/O during settings import.
- `backend/config/settings/base.py`: configurable private Django Storage backend, one-file multipart limit and bounded memory/spooling defaults. Local development retains its defaults.
- `backend/apps/candidates/resumes.py`: optional installed Storage subclass; private filesystem remains default. UUID keys, authenticated streaming, role/company/moderation enforcement and existing transaction/cleanup semantics retained.
- `backend/config/health.py`, `urls.py`: additive public `/api/v1/ready/` database/cache/private-storage round-trip; generic 503 on failure, no-store. Existing `/api/v1/health/` stays dependency-free. Probes ignore invalid bearer headers without changing protected routes.
- `backend/config/test_production.py`: nine new tests cover required/insecure configuration, real production settings import, storage configurability and probe behavior. Existing candidate registration journey now includes a synthetic resume upload/download/delete. Existing recruiter and moderation journeys and cross-company/role/resume security suites pass.
- `frontend/src/features/jobs/services/api.js` and `pages/RecruiterPages.jsx`: protected draft preview/edit lookup now traverses company-job pagination; two regressions verify later-page lookup and rejection of unrelated jobs. It never follows a server-supplied next URL to a different host.
- Documentation: `PRODUCTION_DEPLOYMENT.md`, API conventions/OpenAPI, local development, PROJECT_STATUS and this report. No dependency additions in this task.

## Exact verification

Backend working directory: `backend/`. Django/pytest commands used this runtime prefix (reads ignored .env without editing/printing credentials, generates an ephemeral signing key):

```sh
env -u DATABASE_URL DJANGO_SECRET_KEY="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')" DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')"
```

- `.venv/bin/python -m pytest --tb=short -q`: **PASS, 131 tests in 33.52s**, PostgreSQL **17.5**, original `devjobs_test` at `127.0.0.1:5433`, retained dedicated `test_devjobs_test`. The existing test harness applies migrations only to the dedicated test DB. PostgreSQL 14/18 untouched; no database reset.
- `.venv/bin/python manage.py check`: **PASS**, no issues.
- `.venv/bin/python manage.py makemigrations --check --dry-run`: **PASS**, no changes detected on network-enabled verification. The first sandbox attempt warned that DB access was denied and was not counted as successful history verification.
- `.venv/bin/ruff check .`: **PASS**.
- `.venv/bin/python manage.py check --deploy --fail-level WARNING`: **PASS**, no issues, using synthetic production configuration and an explicitly enabled one-year HSTS/include-subdomains/preload policy. Invoked by Python subprocess with generated secret, dummy `.invalid` database/cache hosts, synthetic allowed host and private root. No dependency network I/O or actual production validation occurred; HSTS policy is a test fixture, not a deployment decision.

Frontend working directory: `frontend/`.

- `npm test`: **PASS, 37 tests across 9 files**, 5.44s. JSDOM still emits non-failing `getComputedStyle` pseudo-element diagnostics in moderation tests.
- `npm run lint`: **PASS**.
- `npm run build`: **PASS**, Vite 6.4.5, 1605 modules, 1.60s. Largest JS asset 524.78 kB / 175.66 kB gzip; existing >500 kB advisory remains.
- `node -e 'const fs = require("node:fs"); const yaml = require("js-yaml"); const schema = yaml.load(fs.readFileSync("../docs/openapi.yaml", "utf8")); console.log("OpenAPI YAML parsed:", schema.openapi, "paths:", Object.keys(schema.paths).length);'`: **PASS**, OpenAPI 3.1.0, 38 paths. YAML parsing only, not full OpenAPI semantic validation.
- Repository `git diff --check`: **PASS**.

Initial backend iterations failed in the newly extended streaming test: explicit response close triggered Django request-finished DB cleanup inside a test transaction; attempted direct stream-handle close was also invalid after DRF handling. These test-only additions were corrected; final full rerun passes. One pytest attempt was blocked by sandbox network access; the final run used the permitted PostgreSQL connection. One frontend command was accidentally invoked at repository root (no package.json); the complete frontend sequence was rerun successfully from frontend/.

## API/schema and migration impact

Only the readiness route is added by this task; existing API response contracts remain compatible. No new schema or migration is needed for hardening. Existing local MVP migrations are still required on any deployment: accounts through 0004, candidates through 0011, companies through 0008, recruiters through 0001, jobs through 0002, applications through 0001, moderation through 0002, plus Django migrations. Migration consistency passes and the complete graph executes in the dedicated test harness. No development or production migrations were applied manually. Preflight and immutable-history/ownership triggers require staged rollout review and appropriate operational access.

## Remaining release blockers and limits

1. Deployment target/process runner, actual domains/origins, secret management, PostgreSQL/Redis connectivity/TLS, trusted proxy topology, static/SPA serving and durable private storage must be selected/configured and verified. No infrastructure was provisioned or deployed. A custom cloud Storage implementation still needs its own installed adapter and production integration tests; none is supplied. A configured absolute local path alone is not durable storage.
2. Coordinated DB/private-storage backup restoration, retention/cleanup operations, edge upload/time/resource limits, dependency/probe monitoring and alert ownership, staging migration rollout and rollback rehearsals remain operational gates. Live production Redis, storage, edge and TLS were not available for verification.
3. Existing browser MVP gaps: no candidate/recruiter profile editing or company creation/membership-management screens/routes. APIs and registration-created profiles are implemented/tested, but a newly registered recruiter with no company membership cannot complete onboarding through the browser. Company job listing/dashboard still display only their first result page (detail/edit lookup now handles all pages). These pre-existing P0 usability gaps are recorded, not represented as completed browser journeys.
4. Integration verification uses Django API clients plus frontend component/transport tests; no real-browser cross-service end-to-end automation was run. Browser staging smoke tests remain required. JWT localStorage XSS exposure is the existing documented authentication tradeoff; auth model was not changed. Structural PDF validation is not malware scanning/sanitization.
5. The substantial existing MVP changes remain untracked/uncommitted and are not verified by hosted CI in this task. Preserve/review them in a future authorized Git workflow before release. PR #1 was not queried or altered.

No conflict markers or model/migration inconsistencies were found by the review/checks. Existing local changes were retained. No .env writes, staging, commits, pushes, approvals, merges, deployment or infrastructure actions occurred.

## Complete Git working-tree status

Branch: `feat/private-candidate-resumes`. The following is `git status --short --untracked-files=all`; all entries are unstaged. Generated ignored builds/test caches are excluded by Git.

```text
 M .github/workflows/backend.yml
 M .gitignore
 M PROJECT_STATUS.md
 M backend/apps/accounts/models.py
 M backend/apps/accounts/tests.py
 M backend/config/settings/base.py
 M backend/config/settings/prod.py
 M backend/config/urls.py
 M backend/pytest.ini
 M backend/requirements/base.txt
 M docs/API_CONVENTIONS.md
 M docs/DATA_MODEL.md
 M docs/LOCAL_DEVELOPMENT.md
 M frontend/src/app/App.jsx
 M frontend/src/components/molecules/PrimaryNavigation.jsx
 M frontend/src/features/jobs/pages/JobSearchPage.jsx
 M frontend/src/styles/global.css
 M frontend/src/test/setup.js
?? backend/apps/accounts/migrations/0004_supported_role_constraint.py
?? backend/apps/accounts/serializers.py
?? backend/apps/applications/__init__.py
?? backend/apps/applications/api.py
?? backend/apps/applications/api_tests.py
?? backend/apps/applications/apps.py
?? backend/apps/applications/migrations/0001_initial.py
?? backend/apps/applications/migrations/__init__.py
?? backend/apps/applications/models.py
?? backend/apps/candidates/__init__.py
?? backend/apps/candidates/api.py
?? backend/apps/candidates/api_tests.py
?? backend/apps/candidates/apps.py
?? backend/apps/candidates/management/commands/cleanup_resumes.py
?? backend/apps/candidates/migrations/0001_initial.py
?? backend/apps/candidates/migrations/0002_alter_skill_options.py
?? backend/apps/candidates/migrations/0003_alter_candidateprofile_country.py
?? backend/apps/candidates/migrations/0004_remove_candidateprofile_candidates_profile_country_alpha2_and_more.py
?? backend/apps/candidates/migrations/0005_profile_role_compatibility_triggers.py
?? backend/apps/candidates/migrations/0006_scope_role_trigger_to_role_changes.py
?? backend/apps/candidates/migrations/0007_strict_skill_name_canonical.py
?? backend/apps/candidates/migrations/0008_fail_closed_profile_role_guard.py
?? backend/apps/candidates/migrations/0009_explicit_skill_whitespace_constraint.py
?? backend/apps/candidates/migrations/0010_skill_whitespace_exactness.py
?? backend/apps/candidates/migrations/0011_candidateresume.py
?? backend/apps/candidates/migrations/__init__.py
?? backend/apps/candidates/models.py
?? backend/apps/candidates/resume_api.py
?? backend/apps/candidates/resume_tests.py
?? backend/apps/candidates/resumes.py
?? backend/apps/candidates/tests.py
?? backend/apps/companies/__init__.py
?? backend/apps/companies/api.py
?? backend/apps/companies/api_tests.py
?? backend/apps/companies/apps.py
?? backend/apps/companies/migrations/0001_initial.py
?? backend/apps/companies/migrations/0002_alter_company_headquarters_country_and_more.py
?? backend/apps/companies/migrations/0003_alter_company_headquarters_country.py
?? backend/apps/companies/migrations/0004_companymembership_companies_one_active_owner.py
?? backend/apps/companies/migrations/0005_remove_company_companies_hq_country_alpha2_and_more.py
?? backend/apps/companies/migrations/0006_deferred_active_owner_guard.py
?? backend/apps/companies/migrations/0007_serialize_deferred_integrity_checks.py
?? backend/apps/companies/migrations/0008_company_is_suspended.py
?? backend/apps/companies/migrations/__init__.py
?? backend/apps/companies/models.py
?? backend/apps/companies/services.py
?? backend/apps/companies/tests.py
?? backend/apps/jobs/__init__.py
?? backend/apps/jobs/api.py
?? backend/apps/jobs/api_tests.py
?? backend/apps/jobs/apps.py
?? backend/apps/jobs/migrations/0001_initial.py
?? backend/apps/jobs/migrations/0002_job_is_hidden.py
?? backend/apps/jobs/migrations/__init__.py
?? backend/apps/jobs/models.py
?? backend/apps/moderation/__init__.py
?? backend/apps/moderation/api.py
?? backend/apps/moderation/migrations/0001_initial.py
?? backend/apps/moderation/migrations/0002_immutable_history.py
?? backend/apps/moderation/migrations/__init__.py
?? backend/apps/moderation/models.py
?? backend/apps/moderation/tests.py
?? backend/apps/recruiters/__init__.py
?? backend/apps/recruiters/api.py
?? backend/apps/recruiters/apps.py
?? backend/apps/recruiters/migrations/0001_initial.py
?? backend/apps/recruiters/migrations/__init__.py
?? backend/apps/recruiters/models.py
?? backend/apps/recruiters/tests.py
?? backend/config/health.py
?? backend/config/settings/production_validation.py
?? backend/config/settings/test.py
?? backend/config/test_production.py
?? backend/conftest.py
?? docs/PRODUCTION_DEPLOYMENT.md
?? docs/RELEASE_REVIEW.md
?? docs/openapi.yaml
?? frontend/src/features/auth/AuthContext.jsx
?? frontend/src/features/auth/AuthPages.jsx
?? frontend/src/features/auth/AuthPages.test.jsx
?? frontend/src/features/auth/RouteGuard.jsx
?? frontend/src/features/auth/api.js
?? frontend/src/features/auth/api.test.js
?? frontend/src/features/auth/authContext.js
?? frontend/src/features/auth/useAuth.js
?? frontend/src/features/jobs/pages/ApplicationsPage.jsx
?? frontend/src/features/jobs/pages/JobDetailPage.jsx
?? frontend/src/features/jobs/pages/JobsPages.test.jsx
?? frontend/src/features/jobs/pages/RecruiterPages.jsx
?? frontend/src/features/jobs/pages/RecruiterPages.test.jsx
?? frontend/src/features/jobs/services/api.js
?? frontend/src/features/jobs/services/api.test.js
?? frontend/src/features/jobs/utils/format.js
?? frontend/src/features/moderation/AdminPage.jsx
?? frontend/src/features/moderation/AdminPage.test.jsx
?? frontend/src/features/resumes/ResumePage.jsx
?? frontend/src/features/resumes/ResumePage.test.jsx
?? frontend/src/features/resumes/api.js
?? frontend/src/features/resumes/api.test.js
```

Totals: 18 modified tracked files, 99 untracked files, zero staged files.

## MVP workflow completion — latest review (2026-11-07)

This entry supersedes the earlier browser/profile/company gaps and verification counts
above; earlier entries and Git listings remain historical snapshots. Deployment is still
blocked by the operational gates already documented.

### Implemented workflows and files

- `frontend/src/features/profiles/ProfilePage.jsx` and its tests: all supported candidate
  profile fields, own skill add/remove, recruiter profile edit, server field errors,
  loading/retry and saved-state feedback. Resume UI is reused unchanged.
- `frontend/src/features/companies/CompanyPage.jsx` and tests: company create/view/edit,
  active membership role display, membership creation/role/status/removal for authorized
  recruiters. MEMBER gets read-only details. Owner and self mutations are unavailable;
  no ownership transfer control is exposed. Changing the company route remounts state.
- App routes/navigation and lazy page loading connect these workflows to existing dashboards.
- `RecruiterPages.jsx`, `api_tests.py` and `api.py` in jobs: company job next/previous
  pagination, status filtering, reset on filter/company change, stale-response protection,
  and dashboard counts across all pages. Existing company discovery keeps its complete
  array contract. No incompatible API response change; optional company-job `status`
  query parameter documented in OpenAPI. No new schema or migrations for this milestone.
- `frontend/playwright.config.js`, `frontend/e2e/workflows.spec.js`, `backend/run_browser.py`:
  Chromium against real Django/Vite, isolated candidate/recruiter/member/admin contexts,
  UUID-tagged synthetic data, test database identity/version guard and temporary resume
  directory. Runner disables the synthetic admin on exit; other synthetic records remain
  for diagnosis. No database reset, production credentials or real personal data.
- Added only test dependency `@playwright/test`: existing Vitest/jsdom cannot run real
  browser journeys. Browser traces/reports are ignored and must remain private.

### Exact latest verification

Backend commands below use the runtime environment prefix documented earlier in this
report, reading ignored `.env` without modifying or printing it and generating a signing
key in memory. All database use was PostgreSQL **17.5**, dedicated `devjobs_test` and
`test_devjobs_test` at `127.0.0.1:5433`; PostgreSQL 14/18 were untouched.

| Command | Result |
|---|---|
| `cd backend` then `.venv/bin/python -m pytest --tb=short -q` | PASS: 132 tests, 32.52s |
| `cd backend` then `.venv/bin/python manage.py check` | PASS: no issues |
| `cd backend` then `.venv/bin/python manage.py makemigrations --check --dry-run` | PASS: no changes detected, network-enabled history check |
| `backend/.venv/bin/ruff check backend` | PASS |
| `cd frontend` then `npm test` | PASS: 43 tests in 11 files, 6.13s |
| `cd frontend` then `npm run lint` | PASS |
| `cd frontend` then `npm run build` | PASS: 1607 modules; largest JS 525.90 kB / 175.91 kB gzip, existing size advisory |
| `cd frontend` then `node -e "const s=require('js-yaml').load(require('fs').readFileSync('../docs/openapi.yaml','utf8')); console.log('OpenAPI YAML parsed', s.openapi, Object.keys(s.paths).length, 'paths')"` | PASS: OpenAPI 3.1.0, 38 paths; YAML parsing only |
| `git diff --check` | PASS |
| `cd frontend` then `npx --no-install playwright install chromium` | PASS after network/cache permission retry; Chromium and headless shell installed |

Browser execution uses this exact command from `backend/` (no credentials are printed):

```sh
env -u DATABASE_URL DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')" .venv/bin/python run_browser.py
```

The runner applied pending `candidates.0011`, `companies.0008`, `jobs.0002`, and
`moderation.0001/0002` only to the dedicated `devjobs_test` database. It never resets it.
Initial browser iterations found test-selector mismatches and missing dedicated-database
migrations, corrected before rerunning. A runner filename initially matched pytest's
`*_tests.py` discovery and was renamed to `run_browser.py`; full backend rerun passed.
An initial YAML attempt used unavailable Python PyYAML; final parsing uses existing js-yaml.
The first migration consistency attempt had a sandbox connection warning; the permitted
network rerun passed. Existing non-failing JSDOM pseudo-element diagnostics remain.

`npm audit --json` also ran with network access: six existing toolchain vulnerabilities
(3 moderate, 1 high, 2 critical), affecting Vitest/Vite and transitive test tooling.
No broad dependency upgrades or audit auto-fixes were performed. Resolve these in a
separate reviewed dependency update before release.

Documentation updated: PROJECT_STATUS, API_CONVENTIONS, OpenAPI, TESTING_STRATEGY,
LOCAL_DEVELOPMENT, and this release review. No `.env` writes, deployment, Git staging,
commits, pushes, approvals or merges occurred. Existing modified/untracked work remains.

### Final browser result and remaining gates

**PASS: 1 real Chromium workflow scenario, 23.2s (24.1s runner total)** via the exact
runner command above. Covered candidate/recruiter UI registration/login/profile,
candidate skills and reload persistence, resume upload, company creation and invited-to-active
membership management, MEMBER read-only details and resume denial, job draft creation and
publication, filtered discovery, application submission, recruiter resume download and status
review, withdrawal with 404/403 resume denial, administrator company suspension with job
write enforcement, both cross-role navigation directions, admin-route denial, and persistent
logout. API helpers inspect assertions/fixtures; the product workflows use the browser.
This is one representative local Chromium scenario, not exhaustive device/browser coverage
or a production/staging smoke test. There is no remaining local browser installation blocker.

Remaining release gates: deployment/staging service configuration and operational rehearsals
listed earlier, hosted CI for the unstaged work, existing toolchain audit findings, and the
existing Vite size advisory. No production rollout or release approval is implied.

### Final Git status for this milestone

Branch `feat/private-candidate-resumes`; **22 modified tracked files, 106 untracked files**,
all unstaged; index empty. Existing modified/untracked work preserved. This snapshot
supersedes the earlier status listing in this report.

```text
 M .github/workflows/backend.yml
 M .gitignore
 M PROJECT_STATUS.md
 M backend/apps/accounts/models.py
 M backend/apps/accounts/tests.py
 M backend/config/settings/base.py
 M backend/config/settings/prod.py
 M backend/config/urls.py
 M backend/pytest.ini
 M backend/requirements/base.txt
 M docs/API_CONVENTIONS.md
 M docs/DATA_MODEL.md
 M docs/LOCAL_DEVELOPMENT.md
 M docs/TESTING_STRATEGY.md
 M frontend/package-lock.json
 M frontend/package.json
 M frontend/src/app/App.jsx
 M frontend/src/components/molecules/PrimaryNavigation.jsx
 M frontend/src/features/jobs/pages/JobSearchPage.jsx
 M frontend/src/styles/global.css
 M frontend/src/test/setup.js
 M frontend/vite.config.js
?? backend/apps/accounts/migrations/0004_supported_role_constraint.py
?? backend/apps/accounts/serializers.py
?? backend/apps/applications/__init__.py
?? backend/apps/applications/api.py
?? backend/apps/applications/api_tests.py
?? backend/apps/applications/apps.py
?? backend/apps/applications/migrations/0001_initial.py
?? backend/apps/applications/migrations/__init__.py
?? backend/apps/applications/models.py
?? backend/apps/candidates/__init__.py
?? backend/apps/candidates/api.py
?? backend/apps/candidates/api_tests.py
?? backend/apps/candidates/apps.py
?? backend/apps/candidates/management/commands/cleanup_resumes.py
?? backend/apps/candidates/migrations/0001_initial.py
?? backend/apps/candidates/migrations/0002_alter_skill_options.py
?? backend/apps/candidates/migrations/0003_alter_candidateprofile_country.py
?? backend/apps/candidates/migrations/0004_remove_candidateprofile_candidates_profile_country_alpha2_and_more.py
?? backend/apps/candidates/migrations/0005_profile_role_compatibility_triggers.py
?? backend/apps/candidates/migrations/0006_scope_role_trigger_to_role_changes.py
?? backend/apps/candidates/migrations/0007_strict_skill_name_canonical.py
?? backend/apps/candidates/migrations/0008_fail_closed_profile_role_guard.py
?? backend/apps/candidates/migrations/0009_explicit_skill_whitespace_constraint.py
?? backend/apps/candidates/migrations/0010_skill_whitespace_exactness.py
?? backend/apps/candidates/migrations/0011_candidateresume.py
?? backend/apps/candidates/migrations/__init__.py
?? backend/apps/candidates/models.py
?? backend/apps/candidates/resume_api.py
?? backend/apps/candidates/resume_tests.py
?? backend/apps/candidates/resumes.py
?? backend/apps/candidates/tests.py
?? backend/apps/companies/__init__.py
?? backend/apps/companies/api.py
?? backend/apps/companies/api_tests.py
?? backend/apps/companies/apps.py
?? backend/apps/companies/migrations/0001_initial.py
?? backend/apps/companies/migrations/0002_alter_company_headquarters_country_and_more.py
?? backend/apps/companies/migrations/0003_alter_company_headquarters_country.py
?? backend/apps/companies/migrations/0004_companymembership_companies_one_active_owner.py
?? backend/apps/companies/migrations/0005_remove_company_companies_hq_country_alpha2_and_more.py
?? backend/apps/companies/migrations/0006_deferred_active_owner_guard.py
?? backend/apps/companies/migrations/0007_serialize_deferred_integrity_checks.py
?? backend/apps/companies/migrations/0008_company_is_suspended.py
?? backend/apps/companies/migrations/__init__.py
?? backend/apps/companies/models.py
?? backend/apps/companies/services.py
?? backend/apps/companies/tests.py
?? backend/apps/jobs/__init__.py
?? backend/apps/jobs/api.py
?? backend/apps/jobs/api_tests.py
?? backend/apps/jobs/apps.py
?? backend/apps/jobs/migrations/0001_initial.py
?? backend/apps/jobs/migrations/0002_job_is_hidden.py
?? backend/apps/jobs/migrations/__init__.py
?? backend/apps/jobs/models.py
?? backend/apps/moderation/__init__.py
?? backend/apps/moderation/api.py
?? backend/apps/moderation/migrations/0001_initial.py
?? backend/apps/moderation/migrations/0002_immutable_history.py
?? backend/apps/moderation/migrations/__init__.py
?? backend/apps/moderation/models.py
?? backend/apps/moderation/tests.py
?? backend/apps/recruiters/__init__.py
?? backend/apps/recruiters/api.py
?? backend/apps/recruiters/apps.py
?? backend/apps/recruiters/migrations/0001_initial.py
?? backend/apps/recruiters/migrations/__init__.py
?? backend/apps/recruiters/models.py
?? backend/apps/recruiters/tests.py
?? backend/config/health.py
?? backend/config/settings/production_validation.py
?? backend/config/settings/test.py
?? backend/config/test_production.py
?? backend/conftest.py
?? backend/run_browser.py
?? docs/PRODUCTION_DEPLOYMENT.md
?? docs/RELEASE_REVIEW.md
?? docs/openapi.yaml
?? frontend/e2e/workflows.spec.js
?? frontend/playwright.config.js
?? frontend/src/features/auth/AuthContext.jsx
?? frontend/src/features/auth/AuthPages.jsx
?? frontend/src/features/auth/AuthPages.test.jsx
?? frontend/src/features/auth/RouteGuard.jsx
?? frontend/src/features/auth/api.js
?? frontend/src/features/auth/api.test.js
?? frontend/src/features/auth/authContext.js
?? frontend/src/features/auth/useAuth.js
?? frontend/src/features/companies/CompanyPage.jsx
?? frontend/src/features/companies/CompanyPage.test.jsx
?? frontend/src/features/jobs/pages/ApplicationsPage.jsx
?? frontend/src/features/jobs/pages/JobDetailPage.jsx
?? frontend/src/features/jobs/pages/JobsPages.test.jsx
?? frontend/src/features/jobs/pages/RecruiterPages.jsx
?? frontend/src/features/jobs/pages/RecruiterPages.test.jsx
?? frontend/src/features/jobs/services/api.js
?? frontend/src/features/jobs/services/api.test.js
?? frontend/src/features/jobs/utils/format.js
?? frontend/src/features/moderation/AdminPage.jsx
?? frontend/src/features/moderation/AdminPage.test.jsx
?? frontend/src/features/profiles/ProfilePage.jsx
?? frontend/src/features/profiles/ProfilePage.test.jsx
?? frontend/src/features/resumes/ResumePage.jsx
?? frontend/src/features/resumes/ResumePage.test.jsx
?? frontend/src/features/resumes/api.js
?? frontend/src/features/resumes/api.test.js
```

## CI/security blocker resolution — 2026-11-07

The earlier consolidation audit's PostgreSQL, missing browser CI and six npm
findings are resolved locally. Hosted Actions has **not** executed these changes;
no push, commit or PR action was performed. API/schema/MVP behavior is unchanged.
See `.github/workflows/backend.yml`, `browser.yml`, `frontend.yml`, shared identity
guard in `backend/config/settings/test.py`, `backend/config/test_settings.py`,
`backend/run_browser.py` and `frontend/playwright.config.js`.

| Previous development dependency | Dependency path | Secure resolution |
|---|---|---|
| vitest 2.1.9 (critical) | direct devDependency | 4.1.12; own UI RCE fixed in 3.2.6, redirect traversal in 4.1.11 |
| @vitest/mocker 2.1.9 (moderate) | vitest > mocker | 4.1.12; redirect fix 4.1.11, manual registration injection fix 4.1.12 |
| tinypool 1.1.1 (critical) | vitest > tinypool | removed by Vitest 4; affected ranges <=2.1.0 and <2.1.2, patched 2.1.2 |
| vite 5.4.21 (high, two copies) | vitest > vite; vitest > vite-node > vite | removed nested copies; reuse 6.4.5 (reported aggregate range <=6.4.3, secure boundary 6.4.4) |
| esbuild 0.21.5 (moderate, two copies) | both nested Vite paths > esbuild | removed nested copies; reuse 0.25.12 (fix boundary 0.25.0) |
| vite-node 2.1.9 (moderate) | vitest > vite-node | removed; inherited Vite finding rather than an independent advisory |

These six package entries were in test/development tooling; they do not establish
production application exploitability. No `npm audit fix --force`, forced transitive
overrides, application dependency upgrades or new dependencies were used. Vitest
4.1.12 is smaller in scope than the audit's suggested 5.1.0 migration. Official
[migration notes](https://v4.vitest.dev/guide/migration.html) confirm Vite 6/Node 20+
support and removal of tinypool. The exact 4.1.12 npm engine metadata permits Node 24.

npm 11.3.0 crashed with `edgesOut` while resolving optional peer dependencies,
including in an isolated directory. A temporary npm 11.11.0 invocation regenerated
the existing lockfile in `/tmp` with only the Vitest manifest change, then the
reviewed manifest/lockfile were copied back. Standard `npm ci` succeeded using
npm 11.3.0. No global npm installation was modified. Full and production-only
`npm audit --json` both report **zero vulnerabilities**. Snapshots are private
local artifacts at `/tmp/devjobs-audit-before.json`, `/tmp/devjobs-audit-after.json`
and `/tmp/devjobs-audit-production.json`. This is not a backend dependency audit.

## Release CI/security verification — 2026-11-07

Changes: PostgreSQL services pinned to `postgres:17.5`, with server `PGPORT=5433`,
host mapping `5433:5433` and explicit TCP health checks. Pytest/browser share a
strict 17.5 identity guard; two regression tests reject incorrect versions, ports
and database identities. New Chromium CI provisions its own disposable service,
installs browser OS dependencies and uses the existing readiness-polled harness.
The harness uses the current interpreter; CI disables traces and uploads only
failure PNGs for three days. Frontend CI now runs `npm audit`. Vitest 2.1.9 was
upgraded to exact 4.1.12, reusing Vite 6.4.5/esbuild 0.25.12 and removing vulnerable
nested Vite/esbuild, vite-node and tinypool. API/schema/MVP behavior is unchanged.

Final checks (all PASS unless qualified):

- Backend `env -u DATABASE_URL DJANGO_SECRET_KEY="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')" DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')" .venv/bin/python -m pytest --tb=short -q`: **134 passed, 34.20s**, PostgreSQL **17.5**, separate retained `test_devjobs_test`.
- With the same runtime environment prefix: `.venv/bin/python manage.py check`: no issues; `.venv/bin/python manage.py makemigrations --check --dry-run`: no changes. The first sandbox migration-history probe was denied network access; the network-enabled rerun passed and is the recorded history check.
- Backend `.venv/bin/ruff check .`: all checks passed.
- Backend `CI=true env -u DATABASE_URL DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')" .venv/bin/python run_browser.py`: **1 Chromium scenario passed, 22.5s**. No migrations pending. Runtime secrets were generated in memory and never printed. No database reset or service changes; PostgreSQL 14/18 untouched.
- Frontend `npm ci`: passed from updated lockfile; `npm test`: **43 passed / 11 files**, Vitest 4.1.12, 6.32s. Existing non-failing JSDOM pseudo-element diagnostics remain.
- Frontend `npm run lint`: passed; `npm run build -- --outDir /tmp/devjobs-ci-security-build --emptyOutDir false`: passed, preserving existing dist; existing 525.90 kB chunk advisory remains.
- Frontend `npm audit --json > /tmp/devjobs-audit-after.json` and `npm audit --omit=dev --json > /tmp/devjobs-audit-production.json`: **zero findings**, both exit 0. `npm ls vitest vite vite-node @vitest/mocker esbuild tinypool --all`: passed, secure tree confirmed.
- Node using existing `js-yaml`: parsed all three workflow YAML files and asserted push/PR events, jobs, PG image, PGPORT, port mapping and health-port agreement: passed. Parsed `docs/openapi.yaml`: **OpenAPI 3.1.0 / 38 paths**; syntax parsing only, not semantic contract validation.
- Repository `git diff --check`: passed. Manifest accounting asserts all original 128 paths remain and each of 131 current paths has exactly one commit assignment: passed.

Hosted Actions is **UNVERIFIED**: no push was permitted. Docker/actionlint are not
installed here; YAML/configuration validation and local harness execution do not
prove hosted Ubuntu service/browser execution. Production operational gates in
PRODUCTION_DEPLOYMENT.md remain. No Python vulnerability audit was performed.
No staging, commits, pushes, merges, approvals or PR #1 edits occurred; .env values
were neither changed nor exposed.

Updated proposed four-commit manifest (exact file tables in
`/tmp/devjobs-release-consolidation-audit.md`):

1. `feat(api): consolidate MVP workflows and production safeguards` — **83 files**; adds identity regressions in existing `backend/config/test_settings.py` to the original 82-file assignment.
2. `feat(web): complete candidate recruiter and admin workflows` — **32 files**, unchanged assignment.
3. `test(ci): secure toolchain and add guarded Chromium workflow` — **8 files**; original six plus `.github/workflows/frontend.yml` and new `.github/workflows/browser.yml`. Includes dependency manifest/lockfile security upgrade.
4. `docs(release): document MVP APIs and production release gates` — **8 files**, unchanged assignment.

Working tree: branch `feat/private-candidate-resumes`, **131 paths: 24 modified
tracked, 107 untracked, zero staged/deleted**. All original 128 preserved. Ready
for deliberate source consolidation and a hosted CI attempt; hosted success and
deployment readiness are not claimed.
