# Project status

**Status:** Private resumes and admin moderation implemented locally; production deployment remains unresolved
**Product version:** 0.1.0 (pre-release planning baseline)  
**Last updated:** 2026-11-07

## Confirmed decisions
- Global developer job marketplace.
- Initial audience: IT, AI and full-stack developers.
- Free initial product; monetization later.
- React + Vite + JavaScript frontend.
- Ant Design component library.
- Django REST Framework backend.
- PostgreSQL database.
- JWT authentication.
- Atomic UI composition and consistent design system.
- Modular monolith; no premature microservices.
- Git-based versioning, documented tests and release gates.

## Proposed decisions requiring owner confirmation
- Product name "DevJobs" is provisional.
- UUID primary keys are used for domain entities.
- Initial hosting and production storage provider are not finalized.

## Delivery phases
| Phase | Scope | Status |
|---|---|---|
| 0 | Repository, conventions, docs, CI baseline | Local setup and PostgreSQL checks verified; both hosted workflows passed on latest verified PR #1 head `d048b1720602bcbe19c78d3725a9c07c900e4ce4` |
| 1 | Auth, roles and profiles | Authentication and candidate/recruiter profile APIs implemented and verified |
| 2 | Companies and recruiter membership | Implemented and verified, including membership discovery |
| 3 | Job creation and publishing | Implemented |
| 4 | Job discovery and filters | Implemented |
| 5 | Candidate application workflow | Implemented and verified on PostgreSQL 17.5 |
| 6 | Recruiter applicant workflow | Implemented and verified on PostgreSQL 17.5 |
| 7 | Admin moderation | Implemented and verified locally (2026-11-07) |
| 8 | Security, accessibility, regression and deployment | Local stabilization/regression checks passed; deployment unresolved |

## Authentication foundation review (2026-11-05)
- Email identity is ASCII-only, trimmed, and lowercase; manager authentication, JWT issuance, model saves, and database constraints use the same identity policy. Migration `accounts.0003_canonical_email_constraint` preflights legacy accounts and aborts without changing them if Unicode addresses or canonical duplicates exist.
- Django superusers use the product `admin` role and retain Django's required `is_staff=True` and `is_superuser=True` invariants. This does not implement role-aware onboarding or other Phase 1 features.
- Production HTTPS redirect, HSTS, and trusted reverse-proxy scheme handling are environment-configurable and remain disabled by default for redirects/HSTS and in local development. See `docs/LOCAL_DEVELOPMENT.md` for TLS proxy requirements.
- PR #1 is open and unmerged; no approval or merge is recorded. Its latest verified head is `d048b1720602bcbe19c78d3725a9c07c900e4ce4`. Backend verification #9 [passed](https://github.com/jatin13-14/devjobs/actions/runs/42076673522), and frontend verification #6 [passed](https://github.com/jatin13-14/devjobs/actions/runs/42076673521) on that head.

### Review-fix verification
- Backend: `.venv/bin/ruff check .` passed. `ruff format --check` passed for the five changed Python files. A repository-wide formatter check identifies formatting differences in existing untouched files, so those were left unchanged.
- Backend Django check and `makemigrations --check --dry-run` passed. Fresh SQLite verification via `DATABASE_URL='sqlite:///:memory:' .venv/bin/python manage.py migrate --noinput` applied all migrations, including `accounts.0002_normalize_existing_emails`. Pytest passed (8 tests); SimpleJWT emitted a warning because the local development signing key is shorter than 32 bytes.
- Frontend `npm run lint`, `npm test` (1 test), and `npm run build` passed. Vite retains its existing advisory for the 609.25 kB minified JavaScript chunk.
- `git diff --check` passed. This review did not approve or merge PR #1.

## Definition of done
A task is complete only when:
- Acceptance criteria are met.
- Tests are added/updated and relevant checks pass.
- Authorization and validation are verified where relevant.
- UI is responsive and accessible where relevant.
- Documentation and this status file are updated.
- Changes are reviewed and committed on the correct branch.

## Open decisions and verification limits
- Product name remains provisional.
- PostgreSQL is configured and was verified locally against PostgreSQL 18.3. The backend hosted workflow uses PostgreSQL 17 and passed on the latest verified PR #1 head listed above.

## Foundation verification (2026-11-05)
The dated verification entries below are historical snapshots; where they describe hosted CI as pending or say no commit/push occurred, the later hosted CI reconciliation at the end of this file supersedes them.
- Final local rerun: in `frontend/`, `npm run lint`, `npm test` (1 test), and `npm run build` all passed. Vite 6.4.5 reports a 609.25 kB minified JavaScript chunk, above its 500 kB advisory threshold.
- Final local rerun: in `backend/`, `.venv/bin/python manage.py check`, `.venv/bin/python manage.py makemigrations --check --dry-run`, `.venv/bin/python -m pytest` (2 tests), and `.venv/bin/ruff check .` all passed under Python 3.14.4 and Django 5.2.19. A fresh in-memory SQLite `migrate --noinput` applied all migrations successfully, including `accounts.0001_initial`.
- The custom `accounts.User` uses email login and a UUID primary key. Its initial migration exists, matches the model, and applied with all Django migrations on a fresh in-memory SQLite database.
- PostgreSQL connection was verified using `DATABASE_URL=postgresql://devjobs:devjobs@127.0.0.1:5432/devjobs`; Django selected `django.db.backends.postgresql` and connected to PostgreSQL 18.3 as user/database `devjobs` at `127.0.0.1:5432`.
- Production settings require explicit non-placeholder `DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS` values.
- Frontend build emits a 609.25 kB minified JavaScript chunk, above Vite's 500 kB advisory threshold.
- Local CI workflow files in `.github/workflows/frontend.yml` and `backend.yml` declare push and pull request events with path filters; backend CI provisions PostgreSQL 17 and runs Django checks, migration consistency/application, tests, and Ruff. GitHub API checks on 2026-11-05 returned zero registered workflows and zero runs; `git ls-tree` confirms the workflow files are absent from `main`'s latest commit. Commit and push the workflow files or open/update a PR containing them to trigger CI.
- `git diff --check` passed. A scan of tracked files found no apparent real secrets or credentials; `.env.example` contains documented local-only placeholders (`devjobs` database credentials and replacement secret text). `.env` and `frontend/.env` are ignored.
- Live PostgreSQL checks passed locally against PostgreSQL 18.3: Django system check, migration consistency, full migrations, 2 backend tests, and Ruff. Hosted PostgreSQL 17 CI remains unverified until the workflow files are published.

## Additional review verification (2026-11-05)
- Exact migration `accounts.0002_normalize_existing_emails` was executed with Django's migration executor on a disposable PostgreSQL 16.15 cluster/database under `/tmp` at port 55432. Starting at `0001`, mixed-case and padded addresses were normalized by `0002`. A canonical duplicate pair caused the migration to raise before its queued update batch ran; every email remained byte-for-byte unchanged and `0002` was not recorded in `django_migrations`.
- `0002` has `atomic=True` by Django default. It uses portable ORM iteration and `bulk_update`; there is no PostgreSQL-version-specific SQL. CI declares PostgreSQL 17. The local server was 16.15, so PG17 runtime execution is still pending hosted CI.
- Manager creation, natural-key authentication, and JWT input use the same `normalize_email()` method. Mixed case and surrounding whitespace are covered and passed against PostgreSQL. Database uniqueness rejected canonical duplicates. Password hashing and invalid-password checks remain intact.
- Superuser creation enforces `is_staff=True`, `is_superuser=True`, and product role `admin`; ordinary user creation now rejects those admin grants. Regression tests passed.
- Production enables secure session and CSRF cookies. HTTPS redirect and HSTS remain opt-in. Django trusts `X-Forwarded-Proto: https` only when `DJANGO_SECURE_PROXY_SSL_HEADER=true`; deployment docs require a trusted TLS-terminating proxy to overwrite this header and forward traffic over a private trusted connection.
- `DJANGO_SECRET_KEY` is now required and must be at least 32 characters. The example leaves it empty; docs say to generate a unique key per environment. Backend checks used a generated disposable runtime key and emitted no SimpleJWT short-key warning.
- Backend PostgreSQL system checks, migration consistency, Ruff lint, and all 9 tests passed. Frontend lint, its 1 test, and production build passed. Vite still reports its 609.25 kB chunk-size advisory. Ruff formatter checking the touched base settings file reports existing formatting differences; it was not reformatted wholesale.
- All four original review findings are resolved in the local working tree. No staging, commit, push, approval, or merge occurred.

## Hosted CI reconciliation (2026-11-05)
- At this snapshot, the verified PR #1 head was `fdd9f894c3a194422664168b728f40c9fcc669df`; the later current-state record above supersedes it. The backend workflow uses PostgreSQL 17.
- The older notes below and above that say workflows were unregistered, hosted runs were pending, or no commit/push had occurred describe earlier snapshots and are retained as historical records. They are superseded by the current state above. PR #1 is open and unmerged.

## Final review findings (local changes, 2026-11-05)
- Email identity is ASCII-only, trimmed, and lowercased. `0003` checks legacy rows before adding ASCII/canonical-storage checks and canonical uniqueness; failure leaves account records untouched. Unicode addresses require manual resolution and will not be silently converted or deleted. `save(update_fields=...)` raises if an in-memory email change is omitted from `update_fields`.
- JWT token issuance has a scoped anonymous rate limit. Blank/unset `JWT_TOKEN_RATE` falls back to `5/minute`; malformed values fail settings initialization. Production requires a shared cache (such as Redis) and sanitized forwarded IP headers. DRF `NUM_PROXIES` defaults to zero.
- PostgreSQL 16.15 full backend suite passed (26 tests), including migration tests for mixed-case and whitespace collision preflight, Unicode rejection and Unicode casefold edge cases, account-data preservation on failure, constraint enforcement, and reverse migration. Django checks, migration consistency, Ruff, frontend lint/test/build, and `git diff --check` passed for this working tree. The frontend build retains its existing 609.25 kB chunk advisory. These local changes have not been pushed and have not received hosted CI.

## Remaining staged review fixes (2026-11-05)
- Email identity trims exactly ASCII space, tab, line feed, carriage return, form feed, and vertical tab before ASCII lowercase. Model normalization, migration preflight, PostgreSQL canonical check, and unique expression use the same policy. PostgreSQL migration tests cover tab/newline and form-feed/vertical-tab collisions, preservation on preflight failure, and direct SQL rejection of padded aliases.
- Production settings require `DJANGO_CACHE_URL` with a reachable Redis/Rediss endpoint and fail during startup if missing or unavailable. Development and tests retain local-memory caching. The anonymous JWT throttle remains configurable and defaults to `5/minute`.
- Verified against PostgreSQL 16.15: 28 backend tests passed, including tab/newline and form-feed/vertical-tab preflight collisions, byte-for-byte data preservation when preflight fails, direct SQL rejection of padded aliases, and the explicit local-memory test cache check. Django system checks and migration consistency passed; Ruff lint and formatting checks passed; frontend lint passed, 1 Vitest test passed, and Vite build passed (existing 609.25 kB chunk advisory remains); `git diff --check` passed.
- Production settings probes confirmed startup fails clearly when `DJANGO_CACHE_URL` is absent and when Redis is unreachable/misconfigured. No production Redis service was available to verify a successful live connection.

## Milestone 1 integrity remediation (2026-11-06)
- Added strict test settings that require `DATABASE_URL` for PostgreSQL 17 on `127.0.0.1:5433`, database `devjobs_test`, and a separate `test_devjobs_test` database. SQLite and wrong server/database identities fail before test setup.
- PostgreSQL 17.5 on `devjobs_test` was confirmed. A count-only preflight found zero companies without an active owner, invalid country codes, role/profile conflicts, or noncanonical skills. Country checks and deferred owner/profile role triggers were applied; the partial unique active-owner constraint remains.
- Ownership services lock the company before memberships; transfers demote the former owner to ADMIN. PostgreSQL deferred triggers protect minimum ownership through membership writes and cascaded user deletion, and protect role/profile compatibility. SQLite development does not provide those PostgreSQL trigger guarantees.
- Country checks use the ISO alpha-2 list from pinned `pycountry==24.6.1`; skill save/bulk operations canonicalize values and PostgreSQL rejects direct noncanonical values. No records were rewritten, merged, or deleted by migrations.
- Migrations created and applied to `devjobs_test`: `candidates.0004` country/skill checks, `candidates.0005` profile-role triggers, `companies.0005` ISO-country checks, `companies.0006` deferred minimum-owner checks, `companies.0007` serialized trigger checks, and `candidates.0006` role-trigger scoping. No existing rows were rewritten, merged, or deleted.
- Added integrity, bypass, rollback, and separate-connection concurrency tests using synthetic data. Full PostgreSQL 17.5 backend suite passes (60 tests); targeted integrity tests pass (44 tests), and both concurrency tests pass. Django system checks, migration consistency, repository Ruff, and `git diff --check` pass. PostgreSQL catalog inspection confirms the partial active-owner index, country/skill checks, relationship uniqueness, and five deferred triggers with parent-row locking. The isolated `test_devjobs_test` uses PostgreSQL 17.5, has current migrations, and has zero persisted user rows.
- Final blocker fixes: database role values are constrained to the account model's `candidate`, `recruiter`, and `admin` choices; the deferred profile-role trigger rejects unknown roles. Skill storage now requires lowercase names with exactly one ASCII space between words and rejects all other Python-recognized whitespace. Preflights found zero affected rows; no existing data was changed. Additive migrations `accounts.0004_supported_role_constraint`, `candidates.0007_strict_skill_name_canonical`, `candidates.0008_fail_closed_profile_role_guard`, `candidates.0009_explicit_skill_whitespace_constraint`, and `candidates.0010_skill_whitespace_exactness` are applied to `devjobs_test`. Targeted regressions pass (9 tests) and the full PostgreSQL 17.5 backend suite passes (66 tests). This closes Milestone 1 integrity remediation; no Stage 2 features are marked complete.

## Stage 2 Task 1 — Authentication API (2026-11-06)
- Added candidate and recruiter registration APIs. Each creates the server-assigned account role and the required name-bearing profile atomically. Registration canonicalizes email, applies Django password validators and hashing, rejects duplicate canonical emails, ignores client role/privilege fields, and returns only safe user identity fields.
- Candidate and recruiter registration screens collect a required full name; recruiter registration sends it using the API's `name` field.
- Added `/api/v1/auth/login/` while retaining `/api/v1/auth/token/`. Both return access/refresh tokens plus safe user identity; the existing anonymous JWT issuance throttle remains active. Added API tests for successful registration/login/refresh, validation, duplicate email, role escalation, password hashing, and throttling.
- Updated `docs/API_CONVENTIONS.md`. Schema unchanged; no migrations required. PostgreSQL 17.5 targeted account/auth tests pass (28 tests); full backend suite passes (70 tests). `manage.py check`, `makemigrations --check --dry-run`, Ruff, and `git diff --check` pass.

## Stage 2 Task 2 — Frontend authentication (2026-11-06)
- Added login, candidate registration, and recruiter registration routes using the existing React Router, Ant Design, Axios, and Vite setup. Added role-aware route guards and logout navigation; dashboard features remain out of scope.
- Integrated the JWT pair/safe identity response. Browser auth state stores access and refresh tokens with safe identity in `localStorage`; API calls attach access tokens, coordinate concurrent refreshes through one promise, retry each protected request once, and clear auth on failed refresh. The XSS exposure trade-off and cookie alternative are documented in `docs/API_CONVENTIONS.md`.
- Recruiter registration collects the required full name and sends it as `name`; no company fields are collected. This satisfies the required recruiter profile contract.
- Frontend tests, lint, and production build pass. The existing Vite bundle size advisory remains; Ant Design emits deprecation warnings for `Card.bordered` and `Alert.message` in component tests.

## Stage 2 Task 3 — End-to-end authentication integration (2026-11-06)
- Closed JWT refresh races: concurrent unauthorized requests share one refresh; delayed `401`s reuse an access token refreshed by another request; a pending refresh cannot restore credentials after logout or overwrite/clear a different login. Each request retries once, and auth endpoints remain excluded from refresh retry.
- Added frontend integration coverage for concurrent refresh, late unauthorized responses, retry limits, auth endpoint exclusion, refresh failure/logout, candidate and recruiter route access in both directions, and registration/login form behavior. Existing logout coverage confirms stored tokens and identity are cleared.
- Added backend API coverage for missing, invalid, and expired refresh tokens. Existing registration/login tests cover synthetic accounts, role assignment, duplicate and invalid email, password validation and hashing, and privilege-field rejection. No password or token logging was found in frontend/backend auth code.
- Verification passed: PostgreSQL 17.5 full backend suite (72 tests); frontend Vitest suite (13 tests), ESLint, and Vite production build; Ruff; Django system check; migration consistency check (`No changes detected`); `git diff --check`. Build retains the existing bundle-size advisory. Auth routes remain workspace placeholders; profile and job features were not added. No schema or migration changes were made for this task.

## Stage 2 Task 4 — Candidate and recruiter profile APIs (2026-11-06)
- Added authenticated candidate profile GET/PATCH and own-skill GET/POST/DELETE endpoints, plus recruiter profile GET/PATCH. Role permissions deny cross-role and admin access; profile ownership always comes from `request.user`, and unknown/protected input fields are rejected.
- Candidate skill input uses existing canonicalization and models, reuses globally existing skills, and prevents duplicate candidate-skill associations. No models or migrations changed.
- Added API documentation and OpenAPI descriptions and synthetic-data API coverage. PostgreSQL 17.5 targeted profile API tests pass (7 tests); full backend suite passes (79 tests). Django system check, migration consistency (`No changes detected`), Ruff, and `git diff --check` pass. No schema/migration changes were needed.

## Stage 2 Task 5 — Company and recruiter membership APIs (2026-11-06)
- Added recruiter-only company creation with atomic first active owner assignment through the existing ownership service. Public company detail excludes the private logo storage reference; updates require active owner/admin membership.
- Added owner/admin protected membership listing, recruiter addition, membership role/status updates, ownership transfer through the existing transfer service, and removal. Membership access is scoped to company ID; only recruiter accounts with profiles can be added; duplicate/self assignments and new owner assignment are rejected. Responses omit recruiter email and phone.
- Reused PostgreSQL ownership constraints/triggers and existing locked ownership/status services; added a locked role-change service for non-owner memberships. No schema or migration changes.
- Added synthetic API coverage and updated API conventions and OpenAPI. Targeted PostgreSQL 17.5 company API tests pass (6 tests); full backend suite passes (85 tests). Django check, migration consistency (`No changes detected`), Ruff, and `git diff --check` pass. No migration was generated or applied.

## Stage 2 Task 6 — Job posting APIs (2026-11-06)
- Implemented job creation, public listing/detail, authorized edit/publish/close, and company job listing. New postings are drafts. Active OWNER/ADMIN members manage postings; active MEMBER accounts can read company drafts but cannot manage jobs. Public views return only published, non-expired jobs.
- Added ISO country and currency validation, salary range checks, developer skills, filtering, bounded pagination, and company/recruiter privacy-safe representations. Added schema migration `jobs.0001_initial`.
- Added synthetic job API tests and updated API conventions, OpenAPI, and the data model. Migration `jobs.0001_initial` was applied to the configured development database; PostgreSQL 17.5 test database verification passed. Full backend suite passes (92 tests), including the 7 job API tests. Django check, migration consistency, Ruff, and `git diff --check` pass.

## Stage 2 Task 7 — Candidate applications and recruiter applicant management (2026-11-06)
- Added application submission for published, non-expired jobs; candidate-owned paginated list/detail and withdrawal; and job-scoped recruiter applicant list/detail/status APIs. Recruiter responses omit candidate email, phone, profile/account identifiers, and resume/storage data.
- Candidate/job uniqueness is database-enforced and application creation locks the job row. Application status history records submission and each transition. Recruiter access requires an active company OWNER or ADMIN membership; candidate data omits email, phone, account identifiers, and resume/storage data.
- Statuses: SUBMITTED → REVIEWING / SHORTLISTED / REJECTED; REVIEWING → SHORTLISTED / REJECTED; SHORTLISTED → REJECTED. Candidates may withdraw from SUBMITTED, REVIEWING, or SHORTLISTED. REJECTED and WITHDRAWN are terminal. Resume storage/upload remains out of scope and applications do not require a resume.
- Added schema migration `applications.0001_initial`, synthetic API tests (including concurrent duplicate submissions), and updated API conventions, OpenAPI, data model, and project status. The migration was applied to the configured PostgreSQL development database and the PostgreSQL 17.5 test database. Targeted API tests pass (6); the full backend suite passes (98). Django system check, migration consistency (`No changes detected`), Ruff, OpenAPI YAML parsing, and `git diff --check` pass.

## Stage 2 Task 8 — Candidate job discovery and applications frontend (2026-11-06)
- Replaced the discovery placeholder with a public, responsive jobs search page using debounced API queries, documented filters, pagination, salary/date summaries, and loading/empty/error states. Added public job detail and candidate-only application form, list, and detail pages.
- Added candidate navigation, public job links, anonymous Apply-to-login return navigation, and candidate role guards while preserving the existing recruiter guard and JWT refresh client. Duplicate, expired, and closed job errors are surfaced from backend field errors; withdrawal is available only for withdrawable statuses and refreshes application data.
- No API or schema changes. Updated `docs/API_CONVENTIONS.md`. Frontend Vitest passes (19 tests), ESLint passes without errors, and Vite production build passes with the existing large-chunk advisory.

## Stage 2 Task 9 — Recruiter workspace frontend (2026-11-06)
- Added recruiter dashboard, company job listing, shared create/edit form, job preview and publish/close actions, plus paginated applicant list, applicant detail, and valid application-status controls. Added recruiter navigation while preserving public and candidate routes.
- Integrated the existing recruiter profile, company, company jobs, job mutation/transition, and job-scoped applicant endpoints. Candidate applicant data is displayed only from the privacy-safe response. Added three recruiter-page tests.
- Backend API gaps limit completion: there is no current-user company membership lookup or membership role in company-job responses, so company UUID selection is manual and OWNER/ADMIN versus MEMBER control visibility cannot be reliably implemented. Recruiter job detail GET is public-only; draft detail is loaded from the protected company jobs collection when possible. Server-side authorization remains authoritative.
- Verification passed: `cd frontend && npm test` (22 tests), `npm run lint`, `npm run build`, and repository `git diff --check`. Vite reports a 970.71 kB minified chunk advisory. No API/schema changes were made.

## Stage 2 Task 10 — Recruiter membership discovery (2026-11-06)
- Added `GET /api/v1/recruiters/me/companies/`, which derives identity from the authenticated account and returns only active memberships with company UUID/name, membership UUID, and role. No private contact or storage values are returned; no schema change or migration was needed.
- Recruiter dashboard now loads memberships automatically, selects a sole active company, offers named selection when there are several, and reports an empty state. OWNER/ADMIN membership shows job creation; MEMBER does not. Selected company remains in the URL query state and company jobs reload when selection changes.
- Added backend and frontend membership discovery coverage and updated API conventions/OpenAPI. PostgreSQL 17.5 full backend suite passes (100 tests), including targeted recruiter API tests (4); Django system check, migration consistency, and Ruff pass. Frontend Vitest passes (24 tests), ESLint passes, and Vite build passes with its existing large-chunk advisory. OpenAPI YAML parsing and `git diff --check` pass. No migrations were needed.

## MVP stabilization and frontend performance (2026-11-06)
- Replaced eager page imports with React lazy routes for public search/details, auth, candidate applications, and recruiter workspace pages. Added an accessible loading fallback with reduced-motion handling; route guards, auth provider, public layout, and navigation are preserved.
- Production build changed from one 971.67 kB minified JS asset (315.05 kB gzip) to route-level assets. The largest generated asset is 522.55 kB minified (174.88 kB gzip); other page chunks include recruiter workspace 63.80 kB, job search 31.31 kB, and auth 27.40 kB. Vite still reports its 500 kB advisory on the remaining shared Ant Design chunk.
- Recruiter company job loads now reject out-of-order responses and display results only for the selected company. Membership role controls are also scoped to the selected company while its membership lookup is pending. Added a regression test for a company switch whose earlier request resolves last.
- Added API journey tests that exercise candidate registration, login, profile, search/detail, application, token refresh, and withdrawal; and recruiter registration, login, profile, company membership discovery, job draft/edit/publish, applicant access/status, and closing. No API or schema changes.
- Frontend Vitest: 25 tests passed; ESLint passed; production build passed. PostgreSQL 17.5 identity was confirmed for `devjobs_test`; backend Django system check, migration consistency, full pytest suite (102 tests), Ruff, OpenAPI YAML parsing, and `git diff --check` passed. `docs/LOCAL_DEVELOPMENT.md` now documents deployment configuration requirements, missing static/media integration, and the liveness-only health endpoint.

## Stabilization continuation verification (2026-11-07)
- Continued the existing working tree on `chore/foundation-ci`; no implementation restart or code fixes were needed. Only this status record and `docs/LOCAL_DEVELOPMENT.md` were edited during continuation. API/schema unchanged; no dependencies added.
- Backend command environment: each Django/pytest command used `env -u DATABASE_URL DJANGO_SECRET_KEY="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')" DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')"` from `backend/`. This reads the ignored environment file without modifying it and supplies an ephemeral signing key without logging it.
- `.venv/bin/python -m pytest --tb=short -q`: **PASS**, 102 tests in 25.56s. The fixture confirmed PostgreSQL **17.5**, `127.0.0.1:5433`, original database `devjobs_test`, dedicated test database `test_devjobs_test`; existing keepdb behavior was preserved. No manual database reset or development migration application was performed.
- `.venv/bin/python manage.py check`: **PASS**, no issues. `.venv/bin/python manage.py makemigrations --check --dry-run`: **PASS**, no changes detected on the successful network-enabled rerun; the initial sandboxed attempt warned that PostgreSQL access was denied and was not sufficient to verify migration history. `.venv/bin/ruff check .`: **PASS**.
- From `frontend/`: `npm test`: **PASS**, 25 tests across 5 files; `npm run lint`: **PASS**; `npm run build`: **PASS**, Vite 6.4.5, 1602 modules. Route imports use React lazy/Suspense and the build emits separate auth, search, job detail, applications, and recruiter modules (pages sharing a source module share a chunk).
- Bundle comparison: prior stabilization record measured one JS asset at 971.67 kB / 315.05 kB gzip. Today's largest asset is 522.55 kB / 174.88 kB gzip, matching the existing post-split record. Recruiter pages: 63.80 / 21.42 kB gzip; search: 31.31 / 9.65; auth: 27.40 / 10.30; job detail: 3.89 / 1.57; applications: 3.47 / 1.32. These compare largest assets, not total transferred JavaScript. The prior unsplit build was not recreated; Vite's >500 kB advisory remains.
- OpenAPI parsing: Python attempts failed because PyYAML is absent; no package was installed. Existing frontend `js-yaml` succeeded with `node -e 'const fs = require("node:fs"); const yaml = require("js-yaml"); const schema = yaml.load(fs.readFileSync("../docs/openapi.yaml", "utf8")); console.log("OpenAPI YAML parsed:", schema.openapi, "paths:", Object.keys(schema.paths).length);'`: **PASS**, OpenAPI 3.1.0, 24 paths. This verifies YAML parsing, not full OpenAPI semantic validation.
- `git diff --check`: **PASS**. `gh pr view 1 --json number,state,isDraft,mergedAt,headRefName,url` could not run because `gh` is absent; connected GitHub read verified PR #1 **open**, **merged=false**, head `e0fe214a003769c89c0cda246b2033d14c8bbca2`. Earlier hosted CI snapshots are historical and do not verify the current local stabilization tree.
- Production documentation now distinguishes implemented settings from unresolved deployment work and explicitly records the inherited SQLite fallback in production settings. No production startup/deploy check was claimed: there is no selected deployment target or configured production service environment. Hosting, TLS/proxies, static/SPA serving, PostgreSQL/Redis provisioning, secrets, backups/restore, monitoring, release procedure, and dependency readiness remain unresolved; private resume upload and admin moderation remain incomplete P0 work.
- Final working tree remains dirty with 16 modified tracked files and 18 untracked paths (directory entries collapsed by Git). Existing unrelated work preserved. No `.env` edits, staging, commit, push, approval, merge, or infrastructure changes occurred. PR #1 remains open and unmerged.

## Secure candidate resumes and recruiter access (2026-11-07)

- Implemented candidate-owned metadata/upload/replace/delete at `/api/v1/candidates/me/resume/`, owner download at `/api/v1/candidates/me/resume/download/`, and application-scoped recruiter download at `/api/v1/jobs/{job_id}/applications/{application_id}/resume/`. Application representations add `resume_available`; existing fields remain compatible. Applying still does not require a resume.
- Every recruiter download reuses active OWNER/ADMIN company authorization and job/application scoping. MEMBER, unrelated/cross-company, anonymous, inactive recruiter and suspended/removed/demoted membership access is denied. Withdrawal and inactive candidate accounts revoke recruiter access; job closure, deadline expiry and rejection retain it. The current candidate document is served; there is no application-time snapshot. Deletion revokes future downloads everywhere; authorized already-open streams cannot be recalled.
- Added `candidates.0011_candidateresume`: optional one-to-one current resume metadata/reference. Applied by the test harness to PostgreSQL 17.5's dedicated `test_devjobs_test`; no development migration application or data rewrite was performed. Production/development operators must apply migrations before enabling the feature.
- Private local storage uses UUID PDF keys, restrictive file/directory modes, fixed attachment names, no public routes/URLs or serialized storage keys/paths, no-store download responses, nosniff and sandbox CSP. `RESUME_MAX_BYTES` defaults to 5 MiB; strict structural validation rejects invalid/encrypted/empty PDFs. Added pinned `pypdf==6.12.0` because no installed dependency parsed PDFs; no resume text extraction or AI was added.
- Candidate-row locks serialize mutations, durable transactions prevent later caller rollback, failed replacement cleans the new file, and previous/deleted files are unlinked only after commit. Offline `cleanup_resumes` provides dry-run counts and age-limited orphan cleanup with writers stopped. Crash/cleanup/DB-filesystem consistency limitations and coordinated backup/restore requirements are documented.
- Added a candidate **My Resume** route/navigation, metadata/status, upload, replacement, authenticated blob download and confirmed removal. Authorized applicant detail exposes current-resume download with error handling and unavailable state. Upload overrides the shared JSON Content-Type default; a transport test verifies FormData bytes, and another verifies application-scoped bearer-auth blob downloads and object-URL cleanup.
- Added 12 backend security/transaction/concurrency tests and 7 focused frontend component/transport tests using synthetic in-memory files and temporary storage. No production fixtures or personal/contact records were added.
- Verification environment: backend commands ran from `backend/` with `env -u DATABASE_URL DJANGO_SECRET_KEY="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')" DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')"` as prefix. The ignored `.env` was read without printing or editing its secrets. Network-enabled checks targeted PostgreSQL **17.5**, `127.0.0.1:5433`, original `devjobs_test`, dedicated `test_devjobs_test`; keepdb behavior was preserved. PostgreSQL 14/18 were untouched.
- `.venv/bin/python -m pytest --tb=short -q`: **PASS, 114 tests in 31.95s** (including 12 resume tests). `.venv/bin/python manage.py check`: **PASS**, zero issues. `.venv/bin/python manage.py makemigrations --check --dry-run`: **PASS**, no changes detected. `.venv/bin/ruff check .`: **PASS**. Initial targeted-test failures were corrected during implementation; no pre-existing backend failures remain.
- Frontend commands from `frontend/`: `npm test`: **PASS, 32 tests across 7 files**; `npm run lint`: **PASS**; `npm run build`: **PASS**, 1604 modules. Existing >500 kB bundle advisory remains (largest asset 523.10 kB / 175.03 kB gzip); no pre-existing test failures were observed.
- OpenAPI parsing from `frontend/`: `node -e 'const fs = require("node:fs"); const yaml = require("js-yaml"); const schema = yaml.load(fs.readFileSync("../docs/openapi.yaml", "utf8")); console.log("OpenAPI YAML parsed:", schema.openapi, "paths:", Object.keys(schema.paths).length);'`: **PASS**, OpenAPI 3.1.0, 27 paths. This is YAML parsing, not full semantic validation. Repository `git diff --check`: **PASS**.
- Updated API conventions, OpenAPI, data model, local development/storage/cleanup instructions and this status record. Production still requires selected durable private storage integration, migrations, edge upload/resource limits, coordinated backups/restore, retention and cleanup operations, plus the existing hosting/TLS/static/SPA/PostgreSQL/Redis/secrets/monitoring readiness work. Structural validation does not sanitize PDFs or provide malware scanning. No cloud infrastructure was provisioned; admin moderation remains outstanding P0 work.
- Work is on local focused branch `feat/private-candidate-resumes`. All pre-existing modified/untracked work was preserved. No staging, commit, push, merge, approval or PR #1 operation occurred. Final working tree has 17 modified tracked files and 19 untracked entries (directories collapsed by Git), including the pre-existing work.

## Admin moderation and platform administration (2026-11-07)

- Implemented administrator-only overview, paginated searchable companies/recruiters/candidates/jobs collections, UUID detail views and atomic reason-bearing suspension/reactivation or hide/restore decisions under `/api/v1/admin/`. Added paginated/filterable `/api/v1/admin/history/`. Frontend `/admin` provides overview, resource/state/search controls, paginated tables, details, confirmation/reason dialogs and error/loading/empty states. Login redirects trusted administrators to their workspace; ordinary users see no admin navigation.
- Authorization uses active Django staff/superuser identity, independent of company membership and product role. Safe login identity adds read-only `is_platform_admin`; public registration/profile endpoints cannot grant staff privileges. Backend checks current identity on every authenticated request. Administrator targets require trusted operational management rather than moderation API actions. No administrator or default credential was provisioned.
- Reused account `is_active`; added `Company.is_suspended`, `Job.is_hidden`, and append-only `ModerationEvent` with administrator, target UUID/type, action/reason, old/new boolean state and timestamp. PostgreSQL rejects audit UPDATE/DELETE. API decisions/events commit together and reject repeated no-op decisions. Company locks serialize moderation/publication/application submission; job writes reread current state after acquiring the company lock.
- Suspended accounts lose protected functionality, including existing-token access. Suspended companies lose resource management/applicant/resume access; their jobs leave discovery and reject applications. Job holds prevent discovery/applications/editing/publication until an administrator restores eligibility. Existing records, owner memberships and private files remain intact. Candidate suspension revokes recruiter resume access; job holds retain authorized historical applicant access. Existing cross-company permissions remain enforced; no administrator resume access was added. Already-authorized in-flight requests/streams may finish.
- New migrations: `companies.0008_company_is_suspended`, `jobs.0002_job_is_hidden`, `moderation.0001_initial`, `moderation.0002_immutable_history`. Applied only by the existing dedicated test harness, not to the original development database. Operators must migrate before enabling these routes. No data reset or destructive historical rewrite occurred.
- Final backend verification from `backend/`, each Django/pytest command prefixed with `env -u DATABASE_URL DJANGO_SECRET_KEY="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')" DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')"`: `.venv/bin/python -m pytest --tb=short -q` **PASS, 122 tests in 31.69s**; `.venv/bin/python manage.py check` **PASS, zero issues**; `.venv/bin/python manage.py makemigrations --check --dry-run` **PASS, no changes detected**; `.venv/bin/ruff check .` **PASS**. Target identity: PostgreSQL **17.5**, `127.0.0.1:5433`, `devjobs_test`, dedicated retained `test_devjobs_test`. PostgreSQL 14/18 untouched. Initial migration generation required the documented ephemeral signing key environment and sandboxed history inspection was denied; network-enabled final verification succeeded.
- New coverage includes non-admin denial, profile privilege-field rejection, company/job enforcement and reactivation, existing-token suspension, record retention, resume revocation, admin resume denial, audit update/delete rejection, duplicate decisions on separate connections and publish-versus-hide concurrency. Existing full-suite cross-company, registration escalation, application/status and private-storage tests also passed.
- Frontend commands from `frontend/`: `npm test` **PASS, 35 tests across 8 files**; `npm run lint` **PASS**; `npm run build` **PASS** (existing >500 kB chunk advisory remains; largest asset 524.78 kB / 175.66 kB gzip). Added admin route denial, required reason/confirmed mutation and permission-error component tests. No new dependencies or services.
- OpenAPI parsing: `node -e 'const fs = require("node:fs"); const yaml = require("js-yaml"); const schema = yaml.load(fs.readFileSync("../docs/openapi.yaml", "utf8")); console.log("OpenAPI YAML parsed:", schema.openapi, "paths:", Object.keys(schema.paths).length);'` **PASS**, 3.1.0, 37 paths (YAML parsing, not full semantic schema validation). Repository `git diff --check` **PASS**.
- Updated OpenAPI, API conventions, data model, local administrator provisioning/operational policy and this status. Production hosting/private-storage/TLS/backups/monitoring and release readiness remain unresolved; local functional moderation is complete. Audit integrity assumes controlled database operator privileges. No malware scanner or cloud deployment was added.
- Continued `feat/private-candidate-resumes`, preserving pre-existing modified/untracked files. No `.env` writes/logging, staging, commits, pushes, approval, merge or PR operations. PR #1 was left untouched; its remote state was not queried during this task. Final Git summary: 17 modified tracked files, 21 untracked entries with directories collapsed.

## Release readiness and production hardening (2026-11-07)

- **Verdict: PASS WITH BLOCKERS.** Strict production configuration, configurable private storage, separate dependency readiness and regression checks are implemented locally. See [complete release review](docs/RELEASE_REVIEW.md) for exact commands/results, complete uncollapsed Git status, limitations and migration requirements; see [production runbook](docs/PRODUCTION_DEPLOYMENT.md) for deployment gates.
- Production requires explicit PostgreSQL DATABASE_URL, strong secret, explicit hosts and Redis configuration; validates HTTPS origins, proxy/redirect/HSTS options. Secure cookies/headers enabled. HTTPS redirect defaults on; edge-only enforcement requires an explicit declaration. Local development behavior preserved. Dependency connectivity moved from import-time Redis ping to readiness.
- Added `/api/v1/ready/` (DB/cache/private-storage round-trip, generic status, no-store). Liveness remains `/api/v1/health/`. Private resume storage optionally loads an installed Django Storage subclass; production default filesystem requires an explicit absolute private root. Upload spooling/file-count defaults are bounded; edge resource limits remain required.
- Fixed protected recruiter preview/edit lookups beyond the first company-jobs page. Added nine production/probe/storage tests and two frontend pagination security regressions; extended candidate API journey with synthetic resume upload/download/delete. Existing recruiter/applicant/moderation/security journeys pass.
- Final PostgreSQL 17.5 full suite: **131 passed in 33.52s** on retained dedicated test_devjobs_test; frontend **37 tests / 9 files passed**, lint/build passed (524.78 kB shared chunk advisory and non-failing JSDOM diagnostics remain). Django checks, migration consistency, Ruff, synthetic production check --deploy --fail-level WARNING, OpenAPI YAML parsing (38 paths) and git diff --check passed. Sandbox-denied migration/pytest attempts were rerun with database access; initial new test failures were corrected before final full verification.
- No hardening schema changes. Existing accounts/candidates/companies/jobs/applications/recruiters/moderation migration graph must be rolled out before deployment. No original development/production DB migration/reset performed; PostgreSQL 14/18 untouched.
- Remaining gates: actual hosting/TLS/proxy/static/secrets/services/private-volume configuration; restore-tested coordinated backups, resource/monitoring/retention operations and staging rollout/rollback. Existing browser profile/company management and company-list pagination gaps prevent claiming complete self-service MVP journeys; APIs are tested but no real-browser end-to-end suite was run. No new product scope or infrastructure was added.
- Existing work and PR #1 preserved on feat/private-candidate-resumes. No .env edits, staging, commit, push, approval or merge. Full working-tree inventory is in the release review.

## MVP workflow completion and browser verification (2026-11-07)

- Added role-guarded candidate profile editing for all supported fields and own skill add/remove, plus recruiter profile viewing/editing. Forms show server field validation, loading, success, errors and retry; resume management remains separate.
- Added company creation/detail/edit and membership controls using existing APIs. OWNER/ADMIN can manage; MEMBER sees read-only company details and its active role. Owner/self membership changes and OWNER assignment are deliberately unavailable in this UI. Existing server permissions remain authoritative.
- Company jobs now use next/previous pages and status filters, reset page state on company/filter changes, and reject stale loads. Dashboard totals traverse all pages; recruiter company discovery retains its complete array response and compatibility. Added backend and frontend pagination, profile and membership regressions.
- Added test-only Playwright dependency, Chromium configuration, isolated browser contexts and a guarded `backend/run_browser.py` runner. It verifies PostgreSQL 17.5 at `127.0.0.1:5433/devjobs_test`, applies pending migrations there, uses unique synthetic identities and temporary private resume storage, and disables the temporary administrator on exit. It never resets databases. Synthetic records remain for diagnosis.
- Applied only pending `candidates.0011`, `companies.0008`, `jobs.0002`, and `moderation.0001/0002` migrations to the dedicated `devjobs_test` database for browser execution; PostgreSQL 14/18 and production were untouched. No new schema migration was introduced by this milestone.
- Verification results and browser status are recorded in the latest `docs/RELEASE_REVIEW.md` entry. Deployment and staging operational gates remain unresolved. No staging, commit, push, approval, merge, infrastructure deployment, or .env modification occurred.

- Final milestone verification: PostgreSQL 17.5 backend **132 passed**; frontend **43 passed**;
  real Chromium workflow **1 passed**, 23.2s; frontend lint/build, Django check/migration
  consistency, Ruff, OpenAPI YAML parsing and diff whitespace check passed. Browser
  installation/execution is available locally. Existing toolchain audit reports six
  vulnerabilities (3 moderate, 1 high, 2 critical); broad upgrades remain a separate task.
  Build retains a 525.90 kB largest-chunk advisory. Latest release review supersedes
  previous profile/company/browser gap statements. Git: 22 modified tracked and 106
  untracked files, all unstaged, branch unchanged, index empty.

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

## Staging readiness and release security assurance — 2026-11-07

- Current baseline is `feat/private-candidate-resumes` at `8e5cf77605887b2b5aea72c30376def8130b924c`, clean at review start. Owner reports all three hosted workflows passed on that commit; this supersedes earlier hosted-pending notes for that baseline only. New local review changes have not been pushed or run in hosted CI.
- **Release BLOCKED:** installed-version PyPI/PyPA audit found DRF 3.16.1 and pytest 8.4.2 remain affected outside existing version bounds. Applied targeted pypdf 6.21.4 pin and patched local pip to 26.3; raw findings reduced 70 → 7 (duplicates/aliases included). Full exact inventory/advisories and remediation decisions are in [staging readiness](docs/STAGING_READINESS.md) and `docs/security/`.
- OpenAPI 3.1 semantic validation now covers 39 paths/55 operations, exact Django API routes/methods, unique IDs, UUID path parameters, explicit auth, local references, success schemas and six serializer field sets, with three negative controls. Fixed readiness path, omitted liveness, malformed comma descriptions, missing response schemas and partial-update/decimal/null contract errors. No implemented API or schema change.
- Post-fix backend suite **134 passed, 33.06s**, strict PostgreSQL **17.5**, separate retained test DB; frontend **43 passed / 11 files**, lint/build and npm audit **PASS** (zero findings). Django checks/migration consistency, Ruff and synthetic production deploy/static dry-run checks pass. Existing build-size/JSDOM diagnostics remain.
- PostgreSQL 17.5 compatibility does not establish current security; selecting and verifying patched PG17 server/client binaries is a release gate. PostgreSQL 14/18 and production untouched. No database resets or production migrations.
- Added actionable staging sequence, role/private-resume/moderation/migration smoke plan, explicit PASS/BLOCKED/NOT VERIFIED checklist, and coordinated encrypted backup/isolated restore procedure. **No restore rehearsal or remote staging test performed.** Hosting/TLS/proxy/secrets/services/storage/monitoring and rollback evidence remain deployment gates.
- Changes remain unstaged on the existing feature branch; no commits/pushes, main/PR #1 changes, cloud provisioning, deployment or `.env` modifications. See current release review/staging report for final Git inventory and browser outcome.


## Python dependency blockers resolved — 2026-11-07

**Release-security verdict: PASS WITH BLOCKERS.** Python dependency gate PASS;
remaining PostgreSQL patch-level, infrastructure and operational release gates remain.
This supersedes earlier DRF/pytest blocker statements. DRF **3.16.1 → 3.18.3**,
pytest **8.4.2 → 9.0.3**; Django **5.2.19**, SimpleJWT **5.5.1**, pypdf **6.21.4**,
psycopg/binary **3.3.8**, pytest-django **4.14.0**, Redis client **6.4.0** retained.
Complete runtime/test transitive closures now have exact pins and SHA-256 artifact
hashes; clean Python 3.14.4 install and pip check PASS; Python 3.12/3.13 resolution PASS.
No code/API/schema/authentication change or test fixture adaptation was required.

Resolved IDs: PYSEC-2026-3827, PYSEC-2026-3828, CVE-2026-114136,
CVE-2026-114137, CVE-2026-114138 (runtime DRF), PYSEC-2026-1845
(alias CVE-2025-71176, development pytest). Seven prior raw records are six unique
IDs; pytest was duplicated. pip-audit 2.10.1 over 26 distributions: **zero findings,
zero skips**, no suppressions. Historical evidence preserved alongside new secure
inventory, dependency tree, raw audit and count summary in `docs/security/`.

Verification: backend **134 tests + 59 subtests PASS (33.32s)** on guarded PostgreSQL
17.5; Django check/migration consistency/Ruff PASS; semantic OpenAPI **39 paths /
55 operations PASS**; frontend **43 tests / 11 files PASS (6.23s)**, lint/build PASS;
Chromium **1 PASS (23.1s)**; npm audit **zero**. Existing bundle-size advisory and
JSDOM diagnostics remain. Exact commands, version inventory, compatibility decisions,
advisory aliases/fixed boundaries and limits are in the Python security resolution
section of `docs/STAGING_READINESS.md`. Hosted CI for these local changes unverified.

Branch `feat/private-candidate-resumes`, index empty; existing staging-readiness
work preserved. No .env changes/exposure, database resets, PostgreSQL 14/18 changes,
production infrastructure changes, deployment or Git publishing actions.

Final dependency-task Git check: 7 modified tracked / 8 untracked files, zero
staged/deleted; all initial paths preserved; `git diff --check` PASS. Clean-environment
comparison confirms all 26 installed versions exactly match the audited inventory.

## Security remediation publishing — 2026-11-07

Reviewed all 7 modified tracked and 8 untracked files for the security/staging
remediation commit. Exact dependency pins and SHA-256 hashes, audit evidence,
OpenAPI corrections/validator and staging runbooks are included. Frontend CI now
also triggers on backend requirements changes so all three hosted workflows can
verify the same remediation SHA. No runtime API or database schema changes.
Hosted results will be reported after pushing the feature branch; release
PostgreSQL patch-level and infrastructure/operational gates remain unresolved.
