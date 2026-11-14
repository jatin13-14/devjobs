# Project status

## Final independent E2E working-tree audit — 2026-11-11

Working-tree security review PASS: all 22 changed/untracked files inspected;
continuous socket ownership, signed run/role/PID readiness, disposable cluster
identity, exact-label cleanup and concurrent peer rejection reviewed. No serious
isolation defect found; no production/API/schema/dependency change. Frontend
lint/tests/build PASS, 62 tests / 17 files; backend Ruff and 16 pure safety tests
PASS. Standalone runner PASS: 150 PostgreSQL tests and Chromium 1/1 (32.0s).
Concurrent runner PASS: both 150-test suites (36.56s each), both peer rejection
checks and Chromium 1/1 each (32.2s / 32.3s), zero browser errors. All three owned
containers cleaned; existing development databases were not accessed. Signal
interruption is covered with actual signals and mocked Docker, not live-daemon
fault injection. Candidate long-name checks pass in both themes at 1440/768/390;
Recruiter/Admin theme/viewport regressions pass. API-assisted operations and
coverage gaps are explicitly documented in docs/E2E_ISOLATION.md.

Only the reviewed E2E milestone and selected documentation hunks are eligible for
the requested local commit. Unrelated local operations history remains unstaged.
Independent exact-index verification and commit identities are reported at
delivery without changing the tested tree. No push, merge, deployment or PR edit.

## Critical E2E isolation remediation — 2026-11-11

**PASS for local remediation; supersedes the isolation FAIL below.** Replaced
released fixed-port probes with continuously held per-run sockets inherited by
owned WSGI/Vite services. Readiness now verifies HMAC challenge, run, role and
child PID. Vite websocket transport shares its owned HTTP socket. SIGINT/SIGTERM
are deferred across Docker creation/tracking; exact-label discovery, ID rechecks,
repeated-signal handling and idempotent cleanup preserve the original failure.
No production/API/schema/authentication/dependency or existing database changes.

Frontend lint, 62 tests / 17 files and build PASS; backend Ruff, six-file format
check and 16 pure guard tests PASS. Final standalone runner: 150 PostgreSQL-backed
tests and Chromium 1/1 PASS. Final concurrent command: both runners pass 150 backend
tests and Chromium 1/1, with actual peer service/cluster/credential rejection.
Candidate, Recruiter and Admin Light/Dark switching, rendered colors, persistence
and responsive checks PASS; zero browser errors. Two existing Ant Design warning
classes are counted separately (15 occurrences/scenario). All owned containers,
listeners and private/cache temporary storage cleaned; unrelated stopped welcome
container preserved. POSIX-only; SIGKILL/host loss/unreachable Docker recovery and
hosted CI remain limitations. Exact commands, identities, earlier failures and
files: docs/E2E_ISOLATION.md. Unrelated operations notes preserved. Branch/HEAD
unchanged, index empty; 11 modified tracked / 11 untracked individual files.
No staging, commit, push, merge, rebase, deployment or PR #1 modification.

## Final independent E2E commit gate — 2026-11-11

**FAIL; no commit.** Static review found released application-port probes and
unverified HTTP readiness allow concurrent runners to target another API/database.
Per the explicit serious-isolation-defect stop rule, no Docker mutation suite,
staging or snapshot verification proceeded. Docker daemon available (29.7.2).
Frontend lint, 62 tests / 17 files and build PASS; backend Ruff and 3 pure guard
tests PASS. Both-theme Candidate regression remains unverified in this audit.
Earlier runtime passes are historical and do not satisfy this final gate.
No source/API/schema/production configuration or existing database changes;
unrelated operations notes preserved. Branch/HEAD unchanged, index empty.
Evidence, cleanup interruption risk, commands and next steps: docs/E2E_ISOLATION.md.

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

## Hosted CI moderation timeout follow-up — 2026-11-07

Security commit `d9b5a0a27b518bc162f0575dd6edff6e39f3ea0f` pushed successfully.
Frontend run 42394743060 passed install/audit/lint but its moderation confirmation
test exceeded the default 5s timeout (42 passed, one timeout). Added a focused
15s budget preserving every assertion. Backend CI also triggers on moderation UI
tests to verify server authorization alongside this security-sensitive regression.
Replacement hosted results are pending; no application behavior/schema changes.

Follow-up local validation: targeted moderation test 3/3 PASS; full `npm test`
43/43 PASS; `npm run lint` PASS; `npm run build -- --outDir
/tmp/devjobs-publish-build --emptyOutDir false` PASS (existing chunk advisory).
Initial test invocation from repository root failed ENOENT; corrected frontend
invocations above passed. Repeat Python audit and npm audit: zero findings.

## Role-based frontend redesign — 2026-11-07

Implemented shared themed workspaces with indigo candidate, teal recruiter and
purple admin navigation, responsive sidebars, accessible focus/skip navigation,
reduced motion and long-text wrapping. Candidate overview uses real profile,
resume and application data; skills have a dedicated destination. Recruiter
company/applicant directories, server-backed company job search and grouped job
forms reuse existing APIs. Admin resource navigation, statistic cards, status
labels, audit dates and moderation success feedback are integrated. Registration
and dedicated admin sign-in are redesigned; login return paths respect roles.
No backend/API/schema/authentication-model changes or new dependencies.

Verification and screenshot evidence are recorded in `docs/UI_REDESIGN_REVIEW.md`.
Existing local-readiness documentation changes were preserved. No environment
edits, database resets, PostgreSQL 14/18 changes, deployment, staging, commits,
pushes or PR operations. Work remains on `feat/private-candidate-resumes`.

Final redesign verification: frontend **46 tests / 12 files PASS**, ESLint and
production build PASS (537.30 kB shared-chunk advisory); Chromium **1 PASS, 22.9s**,
including registration screenshots and no uncaught page errors. Workspace widths
1440/768/390 and registration widths 1440/390 fit without document overflow.
`git diff --check` PASS. Git: 16 modified tracked / 6 untracked files,
index empty. See the redesign review for exact commands and verification limits.

## Candidate indigo and navy UI refinement — 2026-11-08

Refined the existing uncommitted redesign: semantic theme/CSS tokens, navy
candidate sidebar, mobile workspace and job-filter drawers, user menu, actual
profile/skills/links overview, deterministic nine-check completion including resume,
and published job preview. Added confirmed profile cancel, application pagination,
job-detail/resume retry and duplicate application submission guard. Existing
Candidate, Recruiter and Admin routes/APIs remain in use. No backend, schema,
permission, environment or database changes; no dependencies added.

Verification details and remaining limits are in `docs/CANDIDATE_UI_REVIEW.md`.
Prior working-tree changes are preserved; no staging, commit, push or deployment.

## Approved candidate reference implementation — 2026-11-08

Replaced candidate overview/metrics with the supplied reference dashboard structure:
welcome, published job rows and compact profile/resume/recent-applications panels.
Added isolated candidate light/dark theme persistence, fixed desktop navigation,
responsive bottom navigation, real-profile account display, header search and private
resume download. Candidate routes and candidate auth screens inherit this shell;
recruiter/admin layout branches are retained. No backend/API/schema/dependency,
environment or database changes, staging, commit, push, PR action or deployment.

Frontend lint, 49 tests/14 files and production build PASS; existing bundle-size
advisory/JSDOM diagnostics remain. Chromium captured both themes at all nine
requested viewports; no dashboard or candidate-route horizontal overflow, theme
persistence, mobile navigation, logout and anonymous route protection PASS.
See docs/CANDIDATE_UI_REVIEW.md for final visual/functional evidence and limits.

## Final Candidate UI audit — 2026-11-08

**Overall FAIL: commit isolation gate blocked.** Candidate live read-only audit
passed both themes at all nine requested sizes without horizontal overflow;
login/search/details/applications/profile/resume display, unsaved input restoration,
theme persistence, mobile navigation and logout passed. Increased mobile buttons
to 44px minimum touch height; corrected obsolete E2E account-menu/dashboard selectors.
Original reference images unavailable this turn: used prior review findings; exact
comparison not repeated. Recruiter login/profile and Admin login/all five sections
passed. Repeated Admin login reproduced HTTP 429 with visible error and Retry-After:
new timeout is rate limiting, with historical cause unprovable without old traces.
No frontend auth defect verified; no backend/auth/API/schema/dependency/data changes.

Final frontend `npm run lint`, `npm test` (49/14 files), `npm run build` PASS;
`git diff --check` PASS. Read-only Chromium final harness PASS with expected
throttling explicitly distinguished from successful logins. Stored mutation E2E
suite not run because this task prohibits database writes. Shared bundle 743.14 kB
(243.14 kB gzip), framework/Ant Design/navigation dependencies; routes already lazy,
no speculative chunking change. Existing JSDOM diagnostics remain non-failing.

All 33 initial individual dirty paths preserved; index empty. Candidate integration
is intertwined with earlier shared Recruiter/Admin layout/theme/redesign changes;
a tested Candidate-only commit boundary has not been established. Following the
explicit stop rule, nothing staged/committed; no SHA, push, merge, PR #1 edit or
deployment. Resolve mixed-change isolation and authorize a disposable browser-test
database before completing the delivery gate. Full inventory, commands, evidence
and limits: `docs/CANDIDATE_UI_REVIEW.md`. Recruiter UI work not begun in this audit.

## Frontend commit boundary resolved — 2026-11-08

Selected verified integrated frontend boundary B: Candidate UI and its existing
shared/Recruiter/Admin layout dependencies. No redesign or backend/API/schema/
production configuration change. Frontend lint, 49 tests / 14 files, build and
read-only three-role browser checks PASS. Mutation E2E skipped: existing runner
requires the prohibited devjobs_test endpoint; no disposable isolation provisioned.
Unrelated local operations notes preserved outside the commit. Full 33-path
classification, staged-snapshot checks, throttle findings and limitations are in
docs/CANDIDATE_UI_REVIEW.md. Recruiter redesign has not begun.

## Approved recruiter reference implementation — 2026-11-08

Implemented a dedicated recruiter layout and dashboard using the attached approved
light/dark desktop/mobile mockup (shared-link fetch unavailable). Added isolated
persistent themes, emerald sidebar/header/bottom navigation, real company/job/
application metrics, paginated application aggregation, recent applicants and
seven-day chart. Existing job/editor/applicant/company/membership/profile routes
inherit role-scoped styling. Search connects to existing company job filtering;
OWNER/ADMIN controls remain restricted, MEMBER applicant aggregation is skipped.
Candidate/Admin source experiences retained; no dependencies, backend/API/schema,
authentication/environment/production settings or database changes.

Frontend `npm run lint`, `npm test` (53 tests/16 files), `npm run build`, and
`git diff --check` PASS. Existing bundle advisory/JSDOM diagnostics remain.
Chromium: 18 dashboard theme/viewport captures and recruiter route overflow checks
PASS; actual job/edit/create/applicant/company/profile views, existing applicant
detail, mobile navigation/logout/protected routing and Candidate checks PASS.
Focused Admin login/all five sections PASS; a later combined run stopped at Admin
HTTP 429, so that combined command is not reported as passing. No further login
attempts or live mutation tests after that limit. Explicit recruiter motion disabling
resolved a hidden account-menu animation state found during browser verification.

Exact reference interpretation, files, screenshots, visual deviations, commands,
permissions/data semantics, scalability limits and separate browser results:
`docs/RECRUITER_UI_REVIEW.md`. Existing documentation edits preserved. Index empty;
no staging, commit, push, merge, PR modification or deployment; original branch and
HEAD retained. Screenshots remain outside Git because they contain live profile data.

## Final recruiter audit — 2026-11-09

Retained the recruiter reference implementation; corrected mobile account touch
width from 40px to 44px and added local-date/partial-page aggregation regressions.
Read-only three-role browser audit PASS, recruiter 18 theme/viewport captures and
routes PASS; Candidate routes and all five Admin sections PASS, zero browser/API
errors. Reference URL unavailable; original-reference comparison not repeated.
Frontend lint, 55 tests / 16 files, build and whitespace checks PASS. Mutation E2E
skipped because authorized disposable database isolation is unavailable. No backend,
API/schema, dependencies, auth security, production configuration or record changes.
Focused local recruiter commit excludes unrelated local-operations documentation.
See docs/RECRUITER_UI_REVIEW.md for exact boundary, independent snapshot checks,
remaining limitations and delivery results. Admin development has not begun.

Independent staged export: lint, 55 tests / 16 files and build PASS; read-only
snapshot browser audit PASS, including corrected 44px controls, all recruiter
sizes/themes, independent API totals and fuller Candidate/Admin/logout checks.
Final local delivery gate PASS with documented reference/E2E limits. Exact
12-path recruiter boundary reviewed; credential/whitespace checks PASS.

## Approved Admin reference implementation — 2026-11-09

Added isolated charcoal/steel-blue/cyan Admin layout, light/dark persistence,
responsive navigation/More, company header search, API-backed dashboard totals and
recent moderation decisions. Existing companies/recruiters/candidates/jobs/history
sections and reason-required moderation retained. Historical chart uses an explicit
unavailable state; unsupported application totals, queues/reports/settings omitted.
No backend/API/schema/auth/environment/dependency changes or live record mutations.

Final frontend lint, 58 tests / 17 files, production build and whitespace check PASS.
Read-only browser audit PASS: 18 dashboard size/theme captures, live totals, all five
sections across nine sizes, search/details, theme persistence, mobile navigation,
logout/protection and Candidate/Recruiter route regressions; zero browser/API errors.
Mutation E2E omitted as required. Existing bundle advisory/JSDOM diagnostics remain.
Visual comparison, exact files, captures, commands and limits: docs/ADMIN_UI_REVIEW.md.
Existing operations notes preserved; original branch/HEAD retained; no staging,
commit, push, merge, PR modification or deployment.


## Final Admin UI audit — 2026-11-09

Corrected overview error retention, removed unsupported application-management
copy, and synchronized header company queries with accurate resource search hints.
Added loading/missing/zero/error data regressions. Charcoal/steel-blue/cyan layout
and existing five resource sections retained; no backend/API/schema/dependency,
authentication/ownership/security or database record changes.
Frontend lint, 62 tests / 17 files, build and whitespace checks PASS. Original
reference unavailable for direct comparison; fresh visual checks documented in
`docs/ADMIN_UI_REVIEW.md`. Mutation E2E skipped without authorized disposable
isolation. Local Django connection exhaustion required a development-process
restart; no database/settings/throttle changes. Existing operations history remains
outside the focused Admin commit. Independent staged and browser results follow
in the Admin review. No push, merge, deployment or PR #1 modification.


Final independent Admin delivery gate **PASS**, with reference and mutation-E2E
limits documented. Exported index lint, 62 tests / 17 files, build and guarded
read-only browser audit PASS. Eighteen dashboard captures and five sections at
nine sizes/both themes pass; live totals, searches/filters/details, role/session/
theme/navigation/logout guards and Candidate/Recruiter regressions pass; zero
browser/API errors. Exact nine-file Admin boundary excludes all operations notes.
Final credential/whitespace/snapshot checks pass; executable source unchanged.
Local commit: `feat(admin): finalize responsive admin workspace`, on
`feat/admin-workspace-final`; next owner-selected milestone may proceed.
No publishing actions or production-readiness certification.

## Git integration and disposable E2E preparation — 2026-11-11

Candidate 84b3381 → Recruiter bd98fc9 → Admin ca9a7c3 are already integrated
linearly at current HEAD on `feat/admin-workspace-final`; no integration performed.
Cached refs only; live divergence/PR #1 state unverified. Replaced the browser
runner's devjobs_test writes with an owned temporary Docker PostgreSQL cluster,
explicit E2E settings and independent cluster identity checks before migrations.
Normal login throttle retained; process-only generated credentials and temporary
private storage. Updated browser CI to use the same owned-container runner.
No API/schema/business logic change. Existing operations notes preserved.

Frontend lint, 62 tests/17 files and build PASS; backend Ruff, 3 pure safety tests
and non-persistent development system check PASS. Full backend DB suite skipped.
Browser execution FAILS CLOSED because Docker is unavailable; no existing database
access, migrations or fixture writes. Runtime verification and coverage gaps remain
blocking acceptance. See `docs/E2E_ISOLATION.md` for integration map, exact commands,
architecture, cleanup and limitations. No environment-file changes, staging,
commits, remote operations, deployment or PR modification; changes remain unstaged.
Final migration consistency check with explicit in-memory configuration and
`git diff --check` PASS; direct Playwright invocation without E2E mode rejected as
expected. Final index empty: 7 modified tracked and 4 untracked paths.


## Docker-isolated E2E runtime completion — 2026-11-11

**PASS**: supersedes the Docker-unavailable blocker above. Docker Desktop 29.7.2
on ARM64 ran the owned PostgreSQL 17.5 tmpfs container with generated credentials,
loopback random port and independent SQL cluster identity before migrations.
Full backend suite **137 PASS**, Django system/migration checks PASS; expanded
Chromium three-role scenario **1 PASS / 0 FAIL (26.8s)**. Candidate and Recruiter
mutation workflows and supported Admin user/job/company moderation, reversals,
reason validation and authorization checks pass. Unsupported Admin application
management was not added. Frontend lint, 62 tests/17 files and build PASS; pure
safety 3 tests, Ruff and whitespace PASS. Existing JSDOM/bundle advisories remain.

Fixed verified long-name Candidate header overflow, runner TIME_WAIT port probe,
and new Admin test selectors. Backend pytest now accepts independently verified
E2E settings in the owned cluster; legacy target policy remains strict. Removed
inherited DB/libpq configuration and disabled dotenv for runner processes; added
SIGTERM cleanup. No API/schema/production/authentication-policy/dependency changes.
All runner containers/private temporary storage removed; unrelated stopped Docker
welcome container preserved. CI reviewed, not remotely executed. Exact commands,
identity evidence, failed attempts, coverage and limits: `docs/E2E_ISOLATION.md`.
Testing strategy updated; unrelated local operations notes preserved. Original
branch/HEAD retained; index empty. No staging, commit, push, merge, rebase, deploy,
PR modification or mutation of existing development databases.

## Milestone 1 authentication and API hardening — 2026-11-12

**PASS for this focused local milestone; ready for independent audit and local
commit.** M-01: explicit shared registration 5/minute and separate refresh
30/minute per-client fixed-window throttles, shared Redis atomic add/increment
in production, HMAC client keys, Retry-After and fail-closed cache errors. Existing
login, production Redis startup guards, JWT lifetimes/refresh/logout semantics
and authorization are retained. M-03: company_id required on create, controlled
400/404 and unchanged PATCH omission. M-04: supplied company filters validate as
UUIDs before filtering (including empty-value 400), public restrictions retained.
M-08: all password validators receive unsaved canonical email/profile identity.
No migrations, dependencies, production secrets, frontend or data-ownership changes.

Targeted auth **37 PASS**, jobs **11 PASS**; final full disposable PostgreSQL suite
**159 PASS (36.78s)**, Django system/migration consistency checks PASS. Ruff and
formatting checks for changed/new code PASS (unrelated existing formatting kept).
Frontend lint, **62 tests / 17 files**, build PASS. OpenAPI **39 paths / 55
operations**, six serializer sets and three negative controls PASS. Standalone
Chromium **1/1 (32.8s)**; concurrent suites **159 each**, peer isolation checks
and Chromium **1/1 each (32.6s / 33.0s)** PASS, zero browser errors. Runner safety
**16 PASS**. Ten independent Redis worker processes admitted exactly 5 registration
and 30 refresh requests from 200 attempts per scope. Existing JSDOM/Ant Design
warnings and bundle advisory remain non-failing. Commands, corrected initial
failures, temporary helper details and limitations: docs/TESTING_STRATEGY.md;
policy and error contracts: docs/API_CONVENTIONS.md and docs/openapi.yaml.

All owned PostgreSQL/Redis verification containers removed; no listeners remain
on verification ports. Existing development databases, services and unrelated
Docker resources were not modified. Redis failover/eviction, clock skew and fixed
window boundary bursts remain operational limitations; existing login retains
DRF's non-atomic cache-history behavior. No hosted CI or production certification.
Starting/ending branch `feat/admin-workspace-final`, HEAD
`bd9a9c8942bf9f6f6e0ab31840406794c0e2b83f`; existing PROJECT_STATUS.md and
LOCAL_DEVELOPMENT.md operations notes preserved. Index empty; no staging, commit,
push, merge, PR #1 edit or deployment. No remaining milestone blocker.


## Milestone 1 independent security gate — 2026-11-12

**FAIL; stopped before staging or commit under the requested unsafe-failure stop
rule.** The fixed-window throttle uses Django RedisCache.add followed by incr.
The installed RedisCacheClient.incr performs separate EXISTS and INCR commands.
If an exhausted counter is evicted after EXISTS observes it but before INCR,
Redis recreates it at 1 without a TTL and the throttle admits another request.
This is a conditional key-loss race, not a demonstrated normal-operation or
client-controlled eviction bypass. It violates the required safe-expiration gate;
ordinary multi-process admission counts do not test this interleaving.

Database-free reproduction:
`backend/.venv/bin/python /tmp/devjobs-m1-independent-race.py` confirmed the
failure for registration (5) and refresh (30), executing the actual project
throttles and installed Django RedisCache add/incr with a simulated Redis command
interleaving. No live Redis, Docker or database was used. The first inline probe
failed because its request stub omitted headers; the corrected helper passed both
assertions. This is a deterministic command-interleaving simulation, not a live
Redis eviction experiment. Resolve with an atomic counter/expiration operation
and add key-loss/TTL regressions before repeating the full independent gate.

Baseline branch/HEAD match `feat/admin-workspace-final` /
`bd9a9c8942bf9f6f6e0ab31840406794c0e2b83f`; initial git diff --check PASS.
The 13 dirty paths match the expected milestone plus unrelated operations notes.
Historical test results above were not independently reconfirmed: full tests,
frontend, OpenAPI, Docker availability/cleanup and Redis multi-process runs were
not executed after the security stop. No staged export, tree verification or
commit exists for this audit. No hosted CI claim. Implementation, API/schema,
production settings and existing documentation text remain unchanged; only this
append-only finding is added to PROJECT_STATUS.md and docs/TESTING_STRATEGY.md.
Existing operations notes remain uncommitted. No database/service/container
access or mutation, push, merge, deployment or PR #1 modification occurred.

## Redis throttle atomicity remediation — 2026-11-12

**PASS for the focused local fix; ready for a new independent audit.** Resolves
the preceding key-loss race: installed Django RedisCache.incr used separate
EXISTS/INCR commands, allowing a lost key to be recreated without expiration.
The throttle now uses one Lua EVAL on the configured Django Redis primary pool.
Creation plus TTL, increment, persistent-counter TTL repair and saturation are
atomic. Existing expiring counters keep their TTL; storage remains 120 seconds
for minute buckets. Saturation prevents integer overflow; invalid values/cache
failures propagate without a memory fallback. Registration remains shared 5/min,
refresh separate 30/min, with unchanged 429/Retry-After, JWT/login and permissions.

Six checked-in real-Redis regression tests PASS, including the old command-loss
interleaving, expiration/recreation, TTL retention/repair, concurrency, overflow
and failure handling. Ten independent processes admitted exactly 5 registration
and 30 refresh requests from 200 attempts per scope, repeated after deleting the
counters; all counters had positive TTLs. PostgreSQL targeted auth 37 and jobs 11
PASS; full suite 159 PASS / 6 Redis-only skipped (run separately against Redis).
Standalone and both concurrent runners repeat 159 PASS / 6 skipped; Chromium
1/1 each, zero browser errors, both concurrent ownership rejection checks PASS.
Ruff, four-file formatting, Django system/migration checks, 16 runner safety tests,
frontend lint/62 tests/build and OpenAPI 39 paths/55 operations PASS. Existing
JSDOM/Ant Design/bundle advisories remain. Exact commands/results and reproducible
coverage boundaries are appended to docs/TESTING_STRATEGY.md.

Key eviction, deletion, restart or failover data loss can still reset quotas.
Release gates: verify noeviction policy, memory capacity/headroom and alerts for
memory, eviction, failed writes and availability/restarts; Redis ACLs must permit
EVAL and the script commands. Noeviction fails closed on memory exhaustion but
does not preserve lost quota history. Deployment configuration was not changed;
clock skew, fixed-window bursts and existing login cache-history behavior remain.

Four owned disposable PostgreSQL containers and the isolated Redis container
were removed; final label queries empty and no owned service/database listeners.
Existing development databases and devjobs_test untouched. This task changed only
throttles.py, new redis_throttle_tests.py and append-only entries in this file and
docs/TESTING_STRATEGY.md. Existing uncommitted work and LOCAL_DEVELOPMENT.md notes
preserved; no API/schema/dependency/secret/production settings changes. Branch
feat/admin-workspace-final and HEAD bd9a9c8942bf9f6f6e0ab31840406794c0e2b83f
unchanged; index empty. No staging, commit, push, merge, deployment or next milestone.


## Final independent Milestone 1 audit — 2026-11-12

Working-tree security audit PASS. Reviewed all 14 dirty paths and installed
Django Redis integration; no serious remaining security defect found. Atomic Lua
creation/expiry, retained TTL, repair and bounded counters remove the original
EXISTS/INCR race. Added minimal exhausted-key recreation and authentication/ACL/
script-error regressions (eight real-Redis tests). Ten processes admit 5/30 from
200 attempts per scope, repeated after deletion with positive TTLs. Twelve
DB-free endpoint probes confirm generic 500 responses with exception diagnostics
for connection/authentication/ACL/script failures; no memory fallback or internal
error text returned. Controlled 503 is deferred as a response-contract change.

Canonical unsaved-user password validation, registration atomicity, shared 5/min
registration and separate 30/min refresh, positive Retry-After, job UUID 400/404,
ownership, PATCH omission and public filtering reviewed. Login/JWT policy,
production settings, schema and dependencies unchanged. Corrected stale API
atomicity documentation and added explicit OpenAPI rate descriptions.

Working checks PASS: Ruff, four-file format and added job-method format checks;
16 safety tests; targeted auth 37 and jobs 11; full disposable PostgreSQL 159
passed / eight Redis-only skipped; frontend lint, 62 tests / 17 files and build;
OpenAPI 39 paths / 55 operations; standalone and both concurrent browser runs.
Exact commands and limitations are in docs/TESTING_STRATEGY.md. Independent index
export must repeat all required checks before the single authorized local commit;
its tree, results and commit identity are delivered separately to avoid changing
an already verified tree. Unrelated operations notes remain outside the index.
Redis loss can reset quotas; noeviction, memory/availability monitoring, sanitized
proxy hops, synchronized clocks and shared-NAT limits remain operational gates.
No hosted CI, push, merge, deployment, PR #1 edit or Milestone 2 work.

## Milestone 2, Stage 1 — M-05 application/admin N+1 queries — 2026-11-12

**PASS locally.** Application lists now select job/company, candidate/user and
optional resume, and prefetch ordered CandidateSkill/Skill objects consumed by
the serializer. This removes per-row user/resume/skill reads and recruiter skill
prefetch bypass. Admin candidate/recruiter collections join both optional profiles;
nullable joins remain outside moderation mutation locks. No admin application
collection exists; no endpoint was invented. Detail responses have fixed query
costs and retain their querysets. No API/schema/dependency/authorization/auth/
JWT/throttle/production-settings change; pagination, ordering and privacy retained.

Measured SQL at 1/5/20 rows: candidate applications 6/18/63 -> 4/4/4; recruiter
applicants 12/24/69 -> 8/8/8; admin candidates 3/7/22 -> 2/2/2; admin recruiters
4/12/42 -> 2/2/2. Three growth tests fail on original code and pass after the fix.
Five new HTTP tests cover query growth, values, skills, resume availability,
missing profiles, pagination/order/no duplicates, isolation and role restrictions.
No latency claim; skill payload size and fixed detail costs remain limitations.

Targeted applications/query 12 and moderation 8 PASS. Full disposable PostgreSQL
164 PASS / 8 Redis-only skipped; standalone and both concurrent runs repeat
164 PASS / 8 skipped and Chromium 1/1 each, zero browser errors. Both concurrent
peer ownership rejections PASS. Ruff, three-file format, system/migration checks,
16 runner safety tests, frontend lint/62 tests/build and OpenAPI 39 paths/55
operations PASS. Existing non-failing warnings retained; hosted CI not run.
Exact commands, before/after evidence and coverage: docs/TESTING_STRATEGY.md.

All seven owned PostgreSQL tmpfs containers removed; all 13 logged verification
ports have no listeners. Independently verified disposable clusters only;
existing development DBs and devjobs_test untouched. Prior operations-note bytes
preserved; LOCAL_DEVELOPMENT.md unchanged by this task. Five task files only;
no staging, commit, push, merge, deployment or PR #1 modification. Starting/ending
branch feat/admin-workspace-final, HEAD 77625e0a5f7c70314e8d833b0069e9a2fd44c23c;
committed tree 3d63ab588b8e4fe5c9f88831055b9aa23e22abf5 unchanged. M-06/M-07 and
Stage 2 not started.

## Independent M-05 audit and local commit gate — 2026-11-12

Independent code/security/SQL review PASS: ordered prefetched skills are consumed,
optional one-to-one joins preserve missing records, no to-many pagination joins,
no premature evaluation, and authorization/response fields remain unchanged.
Independent disposable PostgreSQL HTTP measurements reproduce every before/after
count above; all three growth tests fail against a separate HEAD export and pass
with the implementation. Five new tests plus existing application/moderation
coverage preserve role/company/candidate isolation, resume privacy and pagination.
Working verification PASS: applications/query 12, moderation 8, full 164 passed /
8 Redis-only skipped; Ruff, three-file formatting, 16 runner safety tests, Django
checks/migration consistency, OpenAPI 39 paths/55 operations, frontend lint/62
tests/build, standalone Chromium 1/1 and concurrent Chromium 1/1 each with both
peer isolation checks. No serious defect found; no code corrections required.

Only five milestone paths are eligible for selective staging; unrelated operations
notes remain outside the index. Exact-index export repeats the complete gate;
results, tree and single local commit identity are reported at delivery without
editing the verified snapshot. No hosted CI claim; no push/merge/deploy/PR edit.
Skill payload size and fixed detail costs remain; M-06/M-07/Stage 2 not started.

## Milestone 2 Stage 2A — opt-in backend pagination — 2026-11-13

**PASS locally; M-06 remains open.** Exactly company members, recruiter me/companies
and candidate me/skills GETs support `pagination=page` via a shared helper using
JobPagination. Missing opt-in preserves arrays, fields, ordering, authorization
and mutations; page/page_size alone remains ignored. Empty/unsupported modes 400;
default 20, maximum 100, DRF page/size errors, last and navigation retained.
Authorization/scoping precede count/slicing; joins preserved, SQL LIMIT precedes
serialization, query counts constant at page sizes 1/20/100. No schema/model/index,
frontend/filter/dependency/global-pagination/production-settings change.

Three new multi-endpoint HTTP regression tests cover legacy identity, pagination,
parameters, SQL, empty callers, privacy, roles, scoped counts and suspension.
Targeted API/pagination 16 and company/recruiter service 27 PASS. Full isolated
PostgreSQL 167 passed / 8 Redis-only skipped; standalone and both concurrent runs
repeat 167/8 and Chromium 1/1 each, zero browser errors; both peer isolation checks
PASS. Ruff, new-file and changed-method formatting, Django system/migration checks,
16 runner safety tests, OpenAPI 39 paths/55 operations, frontend lint/62 tests/build
PASS. Existing non-failing JSDOM/Ant Design/bundle warnings retained. Initial fixture
and schema-generation errors corrected; exact commands/results in TESTING_STRATEGY.
No hosted CI claim. API_CONVENTIONS and the three OpenAPI GET operations updated.

All five owned containers cleaned, unrelated stopped container preserved; no
listeners on ten final logged ports. Existing databases/devjobs_test untouched.
Legacy arrays remain unbounded; counts add SQL work and pages may shift with
concurrent writes. No latency/memory claim. Stage 2B adoption/search/lookup and
Stage 2C retirement require separate approval; neither started.
Starting/ending branch feat/admin-workspace-final, HEAD
57b6d328d846056dbca974e57fe33518c06ff2fc, committed tree
df88340b59f36bcf9634e253a3e7df277495fae2 unchanged. Initial operations-note bytes
preserved; LOCAL_DEVELOPMENT.md unchanged by task. Index empty; no staging, commit,
push, merge, deployment or PR #1 modification.

## Independent Stage 2A audit and local commit gate — 2026-11-13

Independent compatibility/security/SQL review PASS; no serious defect found.
Added narrowly scoped tests for repeated-parameter last-value semantics, retained
query parameters, huge page rejection, independent values/fields, ADMIN access,
second-page OFFSET and actual 1/20/100-row query growth. Five pagination tests;
HTTP query counts skills 3/3/3, recruiter companies 3/3/3, company members 6/6/6.
Authorization and scope precede count/slicing; legacy arrays and mutations remain
unchanged. No API compatibility/schema/index/dependency/frontend/production change.

Final working gates PASS: targeted 18, services 27, full disposable PostgreSQL
169 passed / eight Redis-only skipped; Ruff/changed formatting, system/migration
checks, OpenAPI 39 paths/55 operations, safety 16; frontend lint/62 tests/build;
standalone and concurrent Chromium 1/1 each, both peer checks, zero browser errors.
Exact commands/results and intermediate attempts: docs/TESTING_STRATEGY.md.

Only nine milestone paths are eligible for selective staging. Existing operations
notes remain byte-for-byte outside the index. Exact-index export repeats every
required gate before the single local commit; tree/results/commit are delivered
separately so recording them does not change the tested snapshot. Hosted CI not
run. M-06 remains open: legacy arrays unbounded; COUNT/sort/deep-offset costs and
concurrent-write drift remain. No latency/memory claim. Stage 2B/2C not started;
no push, merge, deployment or PR #1 change.

## Milestone 2 Stage 2B.1 — recruiter company discovery — 2026-11-13

Implemented bounded paginated recruiter discovery with caller-scoped trimmed
case-insensitive name substring search (200 characters), exact UUID lookup and
intersection semantics. Blank/malformed UUIDs and malformed search return 400
only in opt-in mode; inaccessible IDs return zero results. Legacy arrays and
ignored-filter behavior retained. ACTIVE/non-suspended authorization, fields,
ordering and default/max 20/100 pagination unchanged. No models/migrations/index,
dependency, production settings, authentication or ownership changes.

Directory, manual-load/server-search picker, dashboard, sidebar and membership-
dependent company/jobs/editor/detail screens consume paginated discovery. Exact
membership lookup has loading/success/empty/error and retry; permissions clear
on switching/logout, older responses are ignored/cancelled. Dashboard uses total
count for sole-company selection and resolves explicit selections independently
of page position. Tenant/job route identity remounts prevent old forms/details/
applicant data carrying across selections. Company membership mutations revalidate.
Member-list pagination UI and candidate skills remain outside this stage.

Local verification: targeted API/pagination 20 and company/recruiter services 27
PASS; full disposable PostgreSQL 171 passed / eight Redis-only skipped. Ruff,
changed-code formatting, Django system/migration consistency, OpenAPI 39 paths/55
operations and 16 runner safety tests PASS. Frontend lint, 75 tests/18 files and
build PASS. Standalone Chromium 1/1 (36.1s), zero browser errors, includes 22-company
discovery/search/exact selection/switch and existing three-role workflows.
Exact commands, initial corrected failures and limitations: docs/TESTING_STRATEGY.md.
API_CONVENTIONS/openapi updated. No hosted CI or production certification.
M-06 remains open: other legacy arrays unbounded; COUNT/deep OFFSET and concurrent
write drift remain. Stage 2B.2/2B.3/2C and M-07 not implemented.

Starting branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82. Original operations-note bytes in this
file preserved as an exact prefix; LOCAL_DEVELOPMENT.md unchanged by this task.
Initial SHA-256 values: PROJECT_STATUS.md
720f31fe6b44d5671f6588e45d311dea6af2853c2ba073124502a45d926363eb;
LOCAL_DEVELOPMENT.md
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
No staging, commit, push, merge, deployment or PR #1 modification.

**Final Stage 2B.1 local acceptance PASS.** Concurrent runner: both PostgreSQL
171/8 suites and Chromium 1/1 each (37.4s), both peer isolation checks PASS, zero
browser errors. All five owned verification containers (including corrected
initial attempt) cleaned; unrelated stopped welcome container retained. No
verification listeners on ten logged final ports. Final branch/HEAD/committed tree
unchanged, index empty, whitespace PASS; original operations notes verified.


## Independent Stage 2B.1 audit stop — 2026-11-13

**FAIL; stopped before staging or committing under the requested serious
correctness-defect stop rule.** useCompanyMembership retains its previous result
and keys it only by user ID, company ID and retry revision. After A resolves as
OWNER, switch to B with its request pending, then return to A. The old A key
matches again and restores canManage=true while the new A request is unresolved.
This is a reproducible stale-permission UI failure; no backend authorization
bypass or cross-tenant database disclosure has been demonstrated. A revoked or
changed A membership can therefore retain stale management controls until lookup
completes. Starting a new lookup must invalidate prior results even when returning
to the same company; keep stale-response protection and cover this sequence.

Added a narrow failing regression in
frontend/src/features/companies/discovery.test.jsx. Independent command from
frontend/: `npm test -- --run src/features/companies/discovery.test.jsx`:
**FAIL, 1 failed / 10 passed**. The A -> B -> A assertion expects canManage=false
but receives true. Implementation was left unchanged for remediation.

Baseline verified: branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; initial index empty and
git diff --check PASS. Full backend/frontend, OpenAPI, runner safety, standalone
and concurrent Chromium, Docker/listener inventory and staged-snapshot gates were
not run after this stop. Historical passes do not satisfy this independent gate.
No staged tree or commit created. No database, Docker resource or service accessed
or modified. Original documentation bytes preserved as prefixes; unrelated
LOCAL_DEVELOPMENT.md unchanged (SHA-256
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60).
Initial whole PROJECT_STATUS.md SHA-256 before this audit:
9866008e42e2b79fc9a1ff10861dc602353548b346570af431643f1636e4f859.
No hosted CI verification, push, merge, deployment or PR #1 modification.
M-06 remains open; Stage 2B.2/2B.3/2C and M-07 were not started.


## Stage 2B.1 stale membership permission repair — 2026-11-13

**PASS for focused remediation; independent audit remains pending.** Reproduced
existing A -> B -> A regression: discovery suite failed 1/11 because returning to
A matched the retained user/company/retry key and exposed cached OWNER permissions
before the new lookup completed. Historical audit failure above is preserved.

useCompanyMembership now rotates an explicit selection resolution identity in
conditional render-time state when user ID, company ID or retry revision changes.
The changing render returns loading without membership; subsequent renders accept
only results carrying that exact identity. Returning to A or an earlier user is a
new lookup. Effect cleanup retains both AbortController cancellation and a live
flag to ignore completions after switching or unmount, including transports that
ignore abort. Errors and missing memberships cannot recover old permissions.
Hook API usage remains compatible; no backend/API/schema/dependency changes.

Inspected all hook consumers in RecruiterPages and RecruiterLayout: management
controls depend on current canManage/membership and pending lookups expose neither.
CompanyPage uses a separate lookup, clears membership on reload, hides the form
while loading and remounts by company ID. Existing tenant/job remounts and data
identity guards retained; no consumer implementation changes needed. Server-side
authorization remains authoritative and unchanged.

Commands from frontend/:
- `npm test -- --run src/features/companies/discovery.test.jsx`: PASS, 19 tests;
  original A -> B -> A regression unchanged. Eight additional cases cover both
  OWNER/MEMBER directions, every-render pending state and disabled controls,
  retry failure/empty after OWNER, older OWNER responses after new MEMBER result,
  aborted unmount and logout/user changes followed by original identity return.
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: PASS, 2 tests.
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: PASS,
  11 tests, including added actual Create job/Applicants controls pending lookup.
- `npm run lint`: PASS.
- `npm test`: PASS, 85 tests / 18 files. Existing non-failing JSDOM pseudo-element
  getComputedStyle diagnostics remain.
- `npm run build`: PASS; existing >500 kB chunk advisory remains (756.31 kB).
Root `git diff --check`: PASS; `git status --short` reviewed;
`git diff --cached --stat`: empty. Initial/final branch feat/admin-workspace-final,
HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82 unchanged. Five repair paths only:
useCompanyMembership.js, discovery.test.jsx, RecruiterPages.test.jsx,
PROJECT_STATUS.md and docs/TESTING_STRATEGY.md. Documentation is append-only;
pre-repair PROJECT_STATUS bytes preserved as a prefix and LOCAL_DEVELOPMENT.md
preserved byte-for-byte. Existing Stage 2B.1 work and regression retained.

Remaining gates: repeat full independent audit and exact staged-snapshot
verification separately; no database-backed, browser E2E, Docker or hosted CI
checks run for this repair. Stage 2B.1 is uncommitted and M-06 remains open.
No staging, commit, push, merge, deployment or PR #1 change. Stage 2B.2 not begun.


## Resumed independent Stage 2B.1 audit stop — 2026-11-13

**FAIL; stopped before staging or committing.** A separate stale-permission
path remains in CompanyPage's CompanyEditor, which does not use the repaired
useCompanyMembership hook. Its component key is company ID only; its load
callback/effect depends on id/form, not authenticated user ID. After an OWNER
lookup succeeds, changing the authenticated recruiter while retaining the same
company route keeps the previous membership and enabled Save company and Add
membership controls indefinitely, without initiating a new membership lookup.
The repaired hook's identity invalidation therefore does not cover this screen.
This is a stale UI authorization defect; no server-side authorization bypass or
cross-tenant database disclosure was demonstrated. Invalidate editor permissions
synchronously on user identity changes and guard obsolete asynchronous results;
add identity-change coverage before resuming the independent acceptance gate.

Added one narrow regression in CompanyPage.test.jsx; existing assertions retained.
Commands from frontend/:
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: FAIL,
  one failed / two passed. Save company remains present and enabled after changing
  the authenticated user from self to other-recruiter with the same company route.
- `npm test -- --run src/features/companies/discovery.test.jsx src/features/jobs/pages/RecruiterPages.test.jsx`:
  PASS, 30 tests / two files. These passes do not cover the separate editor defect.
Root `git diff --check`: PASS; cached stat empty. Baseline branch
feat/admin-workspace-final, HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7,
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82 unchanged.

The hook uses conditional same-component render-time state updates rather than
render-time ref mutation; identity comparison and effect live/abort guards were
inspected. Full Strict Mode/interrupted-render verification was not completed;
no full rendering-safety acceptance is claimed. Backend query construction and
frontend consumers were partially inspected before the defect stop; full SQL,
backend, lint/build, OpenAPI, runner safety, disposable PostgreSQL, standalone and
concurrent Chromium, exact staged-snapshot and post-commit gates were not run in
this resumed audit. Historical passes do not satisfy these gates. No staged tree
or commit exists. No Docker/database/listener was created, accessed or modified;
current Docker/listener inventory was not checked. Existing documentation bytes
preserved as exact prefixes; LOCAL_DEVELOPMENT.md untouched by this audit.
M-06 remains open (legacy arrays, COUNT/deep-offset costs, concurrent-write drift).
Hosted CI was not run. No push, merge, deployment, PR #1 edit or Stage 2B.2/2B.3.


## Stage 2B.1 CompanyPage cross-user permission repair — 2026-11-13

**PASS for focused repair; independent acceptance audit remains pending.**
Reproduced the unchanged audit regression: CompanyPage suite initially failed
1/3 because CompanyEditor was keyed only by company ID and its local membership
load did not depend on authenticated user identity. OWNER controls survived a
same-route recruiter change. The earlier hook repair did not cover this editor;
historical findings above are retained.

CompanyPage now keys CompanyEditor by user ID and company ID, resetting forms,
member lists, errors and pending operations on either change, including logout
and A -> B -> A. Authorization reuses the existing repaired useCompanyMembership
hook and its fresh resolution identity, abort and obsolete-response guards.
Pending/error/empty lookups grant no management permissions. Exact bounded
company-ID discovery remains unchanged; suspended/ineligible memberships remain
excluded by the existing backend lookup. No new company discovery or ownership
transfer UI was introduced. Existing CompanyPage has no ownership-transfer
control; role choices remain ADMIN/MEMBER and owner/self protections remain.

Company/details/member requests use effect-local live guards after each await;
obsolete responses cannot populate the current editor. A commit-time layout-effect
permit invalidates retained mutation handlers on identity change/unmount and
revalidation; reload invalidates it immediately. Company create/edit, membership
create, role/status updates and removal all pass through the guard. In-flight
operations cannot update forms, navigate or trigger reload after invalidation.
Already-issued HTTP mutations are not cancelled/undone; server authorization
remains authoritative. No render-time ref mutation was added. Hook implementation
is unchanged. No backend/API/schema/dependency/production configuration changes.

Repair files only:
- frontend/src/features/companies/CompanyPage.jsx
- frontend/src/features/companies/CompanyPage.test.jsx
- PROJECT_STATUS.md (append only)
- docs/TESTING_STRATEGY.md (append only)

Regression coverage retains the original test and adds OWNER -> MEMBER/ADMIN,
unaffiliated/error/logout, A -> B -> A with late OWNER completion, same-user
company switching, old member-data completion, membership mutation/revalidation
failure and retry, post-logout mutation completion and retained form/role/status/
remove callbacks. Pending assertions run before controlled responses resolve.
Real Ant Design components render; thin test observers retain actual callbacks
for invocation after identity changes. OWNER/ADMIN success and MEMBER restrictions
pass. Missing membership also models the existing suspended-company exclusion;
no live backend suspension test was run in this focused repair.

Final commands from frontend/:
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: PASS, 15 tests.
- `npm test -- --run src/features/companies/discovery.test.jsx`: PASS, 19 tests.
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: PASS, 11 tests.
- `npm run lint`: PASS, no warnings/errors.
- `npm test`: PASS, 98 tests / 18 files. Existing non-failing JSDOM pseudo-element
  getComputedStyle diagnostics remain.
- `npm run build`: PASS; existing 756.31 kB chunk advisory remains.
Root `git diff --check`: PASS; `git status --short` reviewed;
`git diff --cached --stat`: empty. Intermediate repair checks exposed mock-once
leakage after logout (fixed test reset) and a hook dependency lint warning (fixed
by binding stable retry). One npm invocation from repository root failed ENOENT;
all required commands were rerun successfully from frontend/.

Branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82 unchanged; index empty. Prior documentation
bytes preserved as exact prefixes; docs/LOCAL_DEVELOPMENT.md unchanged with SHA-256
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
Existing Stage 2B.1 changes preserved. No staging, commit, push, merge, deployment
or PR #1 modification. No backend/database/Docker/Chromium or hosted CI checks
run. Full independent audit, rendering/concurrency review and exact staged-snapshot
verification remain subsequent gates; this entry does not certify Stage 2B.1 as
committed. M-06 remains open; Stage 2B.2/2B.3 not started.


## Independent Stage 2B.1 audit stop — 2026-11-13 (CompanyJobsList)

**FAIL; stopped before staging or committing.** Baseline confirmed:
branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7, committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
Independent consumer review found CompanyJobsList retains previous-user private
job data on same-company authentication changes. Its wrapper key contains company
and search only; its jobs fetch does not depend on authenticated identity and has
no effect cleanup generation guard. The repaired membership hook hides content
while resolving, then an empty membership allows rendering the retained jobs
because jobsCompanyId still matches companyId. No server authorization bypass was
demonstrated: this is previous-user data retained in frontend state.

Added a narrow regression to RecruiterPages.test.jsx using the real membership
hook and a controlled AuthContext identity change. OWNER loads a private draft;
an unaffiliated user on the same route gets a fresh pending lookup, then an empty
result. The old draft reappears after that result. The test supplies Forbidden
for any subsequent jobs request; none is initiated by identity change.
Required follow-up: bind job data and request lifetimes to authenticated identity,
fail closed for missing membership, and audit other recruiter consumers' retained
data and mutation callbacks before resuming acceptance. No repair performed under
the explicit serious-defect stop rule.

Command from frontend/:
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: FAIL,
  1 failed / 11 passed; failure at the post-empty-lookup private-draft assertion.
Root `git diff --check`: PASS before review and after documentation update.
The two earlier repairs were inspected: hook selection identity rotates through
conditional same-component state updates, with effect-local live/abort guards;
CompanyPage keys by user/company and uses layout-effect mutation permits. No
new defect in those two repairs was established, but complete Strict Mode and
interrupted-render verification is not certified by this stopped audit.

Backend SQL/runtime, full frontend lint/test/build, OpenAPI, runner safety,
disposable PostgreSQL, standalone/concurrent Chromium and staged-export gates
were not run. No staged tree or new commit exists. No Docker/database/listener
was accessed or created; current resource inventory and cleanup were not checked.
All pre-existing documentation bytes retained as exact prefixes;
docs/LOCAL_DEVELOPMENT.md untouched. No API/schema/dependency/production-settings
change. Hosted CI not run. M-06 remains open: legacy arrays, COUNT/deep-offset
costs and concurrent-write drift. No remote operation, push, merge, deployment,
PR #1 modification or Stage 2B.2/2B.3/2C work.


## Stage 2B.1 private-job repair focused verification — 2026-11-13

PASS for the current frontend working tree; independent acceptance remains pending.
Starting snapshot already contained AuthorizedJobScreen, request cleanup, mutation
lifetime guards and 24 recruiter-page tests. The first requested regression run
passed all 24; the historical failing state was not reproduced in this session.
Existing repair/test changes were preserved rather than replaced or attributed
as newly implemented here. This session corrected dynamic component rendering
with React createElement to satisfy the existing no-unused-vars lint rule.

Historical root cause: CompanyJobsList owned private results by company only,
retaining OWNER drafts across same-route user changes and empty membership results.
Current repair keys authorization/data subtrees by authenticated user, company,
job/application route and search. Pending/error authorization unmounts data owners;
logout renders no private subtree. Returning A -> B -> A creates a fresh lookup
and fetch. Fetch generations/cleanup ignore obsolete responses; layout-effect
lifetimes guard retained mutation callbacks and post-request UI effects. No
render-time ref mutation is introduced. Already-issued mutations are not undone.

Backend CompanyJobsView was inspected, not changed: active OWNER/ADMIN may see
private jobs; MEMBER and unaffiliated callers receive the existing published,
non-expired public queryset. Empty membership therefore permits only a fresh
server-authorized public fetch, never retained OWNER results. Filtering, ordering,
pagination and API contracts remain unchanged. Related job detail/editor and
applicant list/detail share the keyed boundary and obsolete-response safeguards;
identity-change regressions cover private details, editable fields and applicant
names. No separate broader defect was established in this focused review.

Existing StrictMode regressions cover immediate and post-lookup absence for
OWNER -> unaffiliated/MEMBER/ADMIN, pending/error/empty membership, retry/fetch
failure, user A -> B -> A, company A -> B -> A, loaded/pending logout, late and
out-of-order responses, reauthorized fresh drafts and current public-only results.
The original unaffiliated regression remains unchanged.

Commands from frontend/:
- npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx: PASS, 24 tests.
- npm test -- --run src/features/companies/discovery.test.jsx: PASS, 19 tests.
- npm test -- --run src/features/companies/CompanyPage.test.jsx: PASS, 15 tests.
- npm run lint: initial FAIL (unused Component); PASS after createElement fix.
- npm test: PASS, 111 tests / 18 files; existing non-failing JSDOM pseudo-element
  getComputedStyle diagnostics remain.
- npm run build: PASS; existing 756.31 kB chunk advisory remains.
Root git diff --check: PASS; git status --short inspected; cached stat empty.
An inspection command used nonexistent AuthProvider.jsx and failed; the actual
AuthContext.jsx was subsequently read. No backend/PostgreSQL/Chromium audit run.

Repair-related paths: frontend/src/features/jobs/pages/RecruiterPages.jsx and
RecruiterPages.test.jsx (implementation/regressions already present at entry),
PROJECT_STATUS.md and docs/TESTING_STRATEGY.md (this append-only verification).
Earlier membership and CompanyPage repairs retained. LOCAL_DEVELOPMENT.md remains
untouched, SHA-256 6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
No backend/API/schema/dependency/production-settings change in this session.
Branch feat/admin-workspace-final; HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7;
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
Nothing staged, committed, pushed, merged, deployed or changed in PR #1.
Independent full audit, disposable PostgreSQL, standalone/concurrent Chromium,
exact staged-snapshot verification and hosted CI remain gates. Stage 2B.1 is
uncommitted. M-06 remains open (legacy arrays, COUNT/deep-offset costs and
concurrent-write drift). Stage 2B.2/2B.3 not started.


## Stage 2B.1 final cross-identity audit stop — 2026-11-13 (CompanyDirectory)

FAIL; stopped before staging or committing under the requested serious-defect rule.
Verified starting branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7 and committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.

CompanyDirectory retains previous-user membership data across same-route account
changes. Its state key contains page/search only, and its request effect has no
authenticated-user dependency. A controlled auth identity change from an OWNER
to an unaffiliated user leaves the original company card and OWNER membership
in the rendered directory. This exposes previous-user membership information;
no server authorization bypass was established. CompanyPicker also lacks a user
dependency, but independent reproduction of that component was not completed.
Dashboard/profile rendering and the remaining recruiter consumers are not certified.

Added a narrow regression in frontend/src/features/companies/discovery.test.jsx
using the existing controlled useAuth mock and real CompanyDirectory rendering.
The new identity's response is held pending; the immediate stale-card assertion
fails. Existing 19 tests pass. No implementation repair was performed.
Required follow-up: bind directory membership state and request lifetime to auth
identity, invalidate rendered memberships synchronously, and cover logout,
returning identities, late responses and failure/retry before resuming acceptance.

Command from frontend/:
- npm test -- --run src/features/companies/discovery.test.jsx: FAIL, 1 failed /
  19 passed (20 total); previous-user company card remains after identity change.

No backend runtime/SQL, PostgreSQL, full frontend lint/test/build, OpenAPI,
runner-safety, standalone/concurrent Chromium or exact staged-export checks ran.
No staged tree or commit was created. No Docker/database/listener was accessed or
created by this audit; existing resource inventory/cleanup status is unverified.
No development database was accessed. No API/schema/dependency/production-settings
change. Earlier documentation bytes preserved by appending; LOCAL_DEVELOPMENT.md
untouched. M-06 remains open: legacy arrays, COUNT/deep-offset costs and
concurrent-write drift. Hosted CI not run. No push, merge, deployment or PR #1
modification; Stage 2B.2/2B.3 not started.


## Stage 2B.1 CompanyDirectory identity repair — 2026-11-13

PASS for focused frontend repair; independent acceptance remains pending.
Reproduced the original discovery regression: 1 failed / 19 passed, with the
previous user's company card and OWNER label still visible after an account
change. The regression is preserved unchanged. Root cause: directory data and
request dependencies were associated only with page/search, not authenticated
identity.

CompanyDirectory now owns results inside a stable user-ID-keyed subtree, rendering
no membership directory on logout. RecruiterLayout similarly keys the authenticated
workspace, including Outlet, by user ID. This small shared boundary resets profile,
dashboard selection, picker pages/search, exact membership lookups and screen state
on identity changes without remounting the application or changing public routes.
Ordinary same-user rerenders preserve state; persisted theme preference survives.
Existing hook and CompanyPage/job-screen authorization repairs remain intact.
CompanyPicker is used inside the recruiter dashboard; its parent selection and
request state are both covered by the shared boundary. It is not independently
hardened for use outside that boundary. No further independent serious defect was
established in this focused review; this is not a complete consumer audit.

Remounting synchronously removes prior memberships and role labels. A -> B -> A
starts a new data owner and fresh requests. Existing effect-local live flags and
AbortControllers prevent obsolete directory, picker and membership completions
from updating the new owner even if transport ignores abort. Search/page URL
parameters remain current route input, while results are newly fetched per user;
no automatic unbounded fetching was added. Existing server authorization remains
authoritative. No render-time ref mutation, dependencies, backend/API/schema or
production configuration change.

Regression coverage: original same-route OWNER -> unaffiliated pending response;
StrictMode OWNER -> MEMBER/ADMIN/empty/error, retry and fresh membership results;
user A -> B -> A, loaded/pending logout, late/out-of-order search and pagination
responses and aborted old signals. Workspace regressions cover stale selection,
ordinary-rerender preservation, profile reset, returning identities, logout,
pending picker load-more/search and exact-company lookup completions. Real Ant
Design controls and actual routed Outlet are used. Existing membership-hook,
CompanyPage and private-job tests remain passing.

Commands from frontend/ (final results):
- `npm test -- --run src/features/companies/discovery.test.jsx`: PASS, 26 tests.
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: PASS, 15 tests.
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: PASS, 24 tests.
- `npm test -- --run src/components/templates/RecruiterLayout.test.jsx`: PASS, 5 tests.
- `npm run lint`: PASS.
- `npm test`: PASS, 122 tests / 18 files; existing non-failing JSDOM pseudo-element
  getComputedStyle diagnostics remain.
- `npm run build`: PASS; 756.38 kB main chunk retains the existing size advisory.
Root `git diff --check`: PASS. Git status reviewed; cached stat empty.
An initial test-writing script ran from frontend/ with root-relative paths and
failed before writing; it was rerun successfully from root. An inspection used
nonexistent frontend/src/App.jsx; actual layout usages were subsequently located.

Files changed by this repair only: frontend/src/features/jobs/pages/CompanyDirectory.jsx,
frontend/src/features/companies/discovery.test.jsx,
frontend/src/components/templates/RecruiterLayout.jsx,
frontend/src/components/templates/RecruiterLayout.test.jsx,
PROJECT_STATUS.md and docs/TESTING_STRATEGY.md (append only).
Prior Stage 2B.1 work and operations notes preserved. LOCAL_DEVELOPMENT.md unchanged,
SHA-256 6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
Branch feat/admin-workspace-final; HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7;
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82; staging index empty.
No staging, commit, push, merge, deployment, PR #1 modification or remote operation.
No PostgreSQL, Docker, Chromium or hosted CI verification ran. Independent full
review, disposable PostgreSQL, standalone/concurrent Chromium, exact staged-export
verification and hosted CI remain audit gates. Stage 2B.1 is uncommitted; M-06
remains open (legacy arrays, COUNT/deep-offset costs, concurrent-write drift).
Stage 2B.2/2B.3 not started.


## Stage 2B.1 independent audit stop — 2026-11-13 (cross-account HTTP replay)

FAIL; stopped on a serious defect before staging or committing. Starting and
ending branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82. Index empty.

Inspected PublicLayout/App routing: recruiter routes do traverse RecruiterLayout,
whose workspace is keyed by stable user.id; directory has its own user boundary.
These boundaries discard local state but do not cancel shared HTTP retries.
Independent complete acceptance of all four repairs is not certified by this stop.

Serious finding: frontend/src/features/auth/api.js handles a late 401 by reading
current storage and retrying whenever its access token differs from the original
request token, without checking the original request identity. An A-account PATCH
held pending, followed by login B and then A's 401, is replayed with B's bearer
and A's original payload. If B is authorized for the target, the server can accept
an unintended mutation as B. This is a client identity-confusion defect; no server
permission bypass is asserted. Remount/lifetime guards cannot prevent the HTTP
interceptor from issuing this retry. The during-refresh identity check does not
cover the earlier newer-token retry branch.

Added a narrow failing regression to frontend/src/features/auth/api.test.js using
the real Axios interceptors and a controlled adapter, synthetic recruiter tokens
and a synthetic PATCH target. It explicitly observes B's token on the replay.
No implementation repair, authentication-model or API-contract change was made.
Required follow-up: bind requests/retries to their originating session and reject
cross-session replay, while retaining same-session refresh behavior; test late 401,
logout, returning identities and pending refresh before resuming this audit.

Command from frontend/: npm test -- --run src/features/auth/api.test.js
FAIL twice: 1 failed / 6 passed (7 total); final assertion shows the old PATCH
payload sent with Bearer recruiter-b-access. Root git diff --check PASS;
baseline/status/cached stat inspected (index empty). One inspection referenced a
nonexistent app/router.jsx; actual app/App.jsx and PublicLayout were then read.

Backend targeted/service/SQL checks, full disposable PostgreSQL, Ruff/format,
Django/migration/OpenAPI/runner safety, full frontend lint/test/build, standalone
and concurrent Chromium and exact staged-export gates were not run in this audit.
No staged-tree SHA or commit SHA was created. All pre-existing modified/untracked
files remain uncommitted, plus the auth regression and these append-only notes.
No Docker resource, listener or database was accessed/created; existing cleanup
and listener status is unverified. Development databases were not accessed.
LOCAL_DEVELOPMENT.md and prior documentation bytes preserved. No production
settings, schema, dependencies or implementation changed. M-06 remains open:
legacy arrays, COUNT/deep-offset costs and concurrent-write drift. Hosted CI not
run. No push, merge, deployment, PR modification or Stage 2B.2 work.


## Focused cross-account HTTP replay repair — 2026-11-13

PASS for focused frontend security repair; independent Stage 2B.1 acceptance
remains pending. Reproduced the preserved original regression before editing:
`npm test -- --run src/features/auth/api.test.js` FAIL, 1 failed / 6 passed;
A's PATCH payload was observed with B's bearer token. The newer-access-token
retry branch had no originating-session check; the refresh branch compared user
IDs, which cannot distinguish logout/re-login as the same user.

The shared HTTP client now captures a local session generation synchronously at
its callable/request/method boundary before Axios queues interceptors. Every
public writeAuth (login, logout or replacement) rotates a random local-storage
session marker, even for identical credentials. Credential/marker snapshots and
storage-event invalidation detect external replacements. Credentials remain the
existing authentication source of truth; no backend token semantics change.
Only the internal refresh persistence path retains the generation.

Request interception rejects obsolete generations before attaching credentials.
Both successful and failed obsolete responses reject with Axios ERR_CANCELED
and sessionExpired=true. Response handling checks before refresh, credential
mutation, newer-token retry and after awaiting refresh; retry request interception
checks again before attaching its bearer. Refresh flights are scoped by generation;
a stale flight cannot clear the replacement flight. One current-session flight
persists rotated tokens once for all waiters. Stale refresh success/failure cannot
restore/overwrite credentials or signal logout for a replacement login. Retries
remain bounded to one and authentication endpoints bypass refresh recursion.
Requests already dispatched are not undone or transport-aborted; their obsolete
completions and retries are invalidated. Server authorization remains authoritative.

Audited AuthContext/AuthPages, storage access, HTTP initialization and API service
imports: production login/logout use writeAuth; all application API services use
the shared http client; plainHttp is used only for refresh. No independent auth
truth, dependencies, backend/API/schema/migration or production-settings changes.
The original cross-account PATCH regression is unchanged. One existing late-401
test now releases its deferred response after actual refresh persistence instead
of simulating refresh with the public login/replacement helper; its success and
single-refresh assertions remain intact.

Controlled adapters/deferred promises verify actual bearer headers and payloads
for GET/POST/PUT/PATCH/DELETE across account switching and same-session refresh,
pending refresh success/failure during B login, B's independent concurrent refresh,
no stale token overwrite/logout, concurrent old requests, identical re-login,
logout/re-login as A, external storage replacement, delayed initial interception,
delayed retry interception and obsolete successful responses. Existing concurrent
refresh, missing restoration, endpoint exclusion and bounded-loop tests pass.

Commands from frontend/:
- `npm test -- --run src/features/auth/api.test.js`: PASS, 26 tests.
- `npm test -- --run src/features/companies/discovery.test.jsx`: PASS, 26 tests.
- `npm test -- --run src/features/companies/CompanyPage.test.jsx`: PASS, 15 tests.
- `npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx`: PASS, 24 tests.
- `npm test -- --run src/components/templates/RecruiterLayout.test.jsx`: PASS, 5 tests.
- `npm run lint`: PASS.
- `npm test`: PASS, 142 tests / 18 files; existing non-failing JSDOM
  getComputedStyle pseudo-element diagnostics remain.
- `npm run build`: PASS; existing main-chunk size advisory remains (~757 kB).
Root `git diff --check`: PASS; `git status --short` inspected;
`git diff --cached --stat`: empty.

Files changed by this repair only: frontend/src/features/auth/api.js,
frontend/src/features/auth/api.test.js, PROJECT_STATUS.md and
 docs/TESTING_STRATEGY.md (documentation appended). Earlier Stage 2B.1 changes,
regressions and operations notes preserved. LOCAL_DEVELOPMENT.md untouched,
SHA-256 6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
Branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
No staging, commit, push, merge, deployment or PR #1 modification. No PostgreSQL,
Docker, Chromium or hosted CI run. Remaining gates: full independent review,
disposable PostgreSQL, standalone/concurrent Chromium, exact staged-export checks
and hosted CI. Stage 2B.1 remains uncommitted; M-06 remains open (legacy arrays,
COUNT/deep-offset cost and concurrent-write drift). Stage 2B.2/2B.3 not started.


## Stage 2B.1 independent authentication continuation audit stop — 2026-11-13

FAIL; stopped on a serious authentication lifecycle defect before staging or
committing. Baseline matches branch feat/admin-workspace-final, HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7 and committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82. Index empty.

AuthContext.jsx login awaits authApi.login and then unconditionally calls
writeAuth/setAuth. The HTTP response interceptor checks session generation before
this promise continuation, but the provider does not revalidate ownership before
persisting credentials. A logout between completed API validation and provider
continuation is overwritten by the old login result, restoring authentication.
This fails the requested guarantee that obsolete responses cannot mutate a
replacement authentication state. No new cross-account HTTP mutation replay or
server authorization bypass was established by this reproduction.

Added frontend/src/features/auth/AuthContext.test.jsx, a narrow controlled
microtask-ordering regression. It uses the real AuthProvider, authApi login and
Axios interceptors with a synthetic adapter, then wraps authApi.login only to
register logout on the completed API promise before the provider continuation.
This deliberately exercises the asynchronous boundary; it does not claim a
manual browser reproduction. The request URL/payload assertion passes and the
stored-auth-is-null assertion fails: synthetic login credentials are restored.
No implementation repair was made. Follow-up: carry originating session ownership
through the provider credential commit and reject obsolete login continuations,
including logout, replacement login and identical-user re-login.

Command from frontend/:
`npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js`
FAIL: 1 failed / 26 passed, 2 files. Existing HTTP replay/refresh tests all pass;
provider regression fails. An initial shell write used a root-relative path from
frontend/ and failed without writing; that initial test invocation ran only the
existing API file (26 passed). The test was then added at the correct path.
Root `git diff --check` PASS; final baseline/index/status rechecked.

Remaining recruiter identity/rendering, backend authorization/SQL/pagination,
frontend integration, full lint/test/build, OpenAPI 39/55 inventory, runner safety,
disposable PostgreSQL, standalone/concurrent Chromium and exact staged-export
verification gates were not completed. No staged/tested tree or new commit exists.
No Docker, database or listener operation was performed; existing resources and
listeners were not inventoried and their status is unverified. No development
database was accessed. Only this regression and append-only documentation were
added; prior implementation, regressions and operations notes preserved.
LOCAL_DEVELOPMENT.md, API/schema/migrations/dependencies/production settings were
not changed by this audit. M-06 remains open (legacy arrays, COUNT/deep-offset
costs, concurrent-write drift). Hosted CI not run. Nothing pushed, merged,
deployed or changed in PR #1; Stage 2B.2/2B.3 not started.


## Focused stale login continuation security repair — 2026-11-13

PASS for focused frontend repair; independent Stage 2B.1 acceptance remains pending.
Baseline reproduced with the exact requested auth command: 1 failed / 26 passed.
The original controlled regression is preserved: logout after Axios validation but
before AuthProvider resumes previously allowed unconditional writeAuth/setAuth to
restore the obsolete login. No backend authentication contract change is needed.

Pending login ownership now lives alongside the existing session-generation logic
in auth/api.js. Each beginLogin creates a unique operation associated with the
current session generation and supersedes the previous pending operation. Starting
an attempt does not rotate the established session or invalidate ordinary requests.
Logout/replacement writeAuth rotates the existing session generation, including
identical-user re-login. Same-session refresh retains that generation. commitLogin
synchronously validates operation identity and session generation, writes credentials,
and consumes ownership. AuthProvider immediately sets its state in the same call
stack, without an await. Stale success/failure rejects with Axios ERR_CANCELED and
sessionExpired=true; failures never clear the active session. Current login failure
retains existing credentials, as before. Effect cleanup cancels the provider-owned
pending operation; Strict Mode cleanup/setup performs no credential writes. No
render-time mutation or additional persisted authentication source is introduced.

All production credential writers remain the shared writeAuth and internal refresh
persistence path. Existing Axios request/retry generation protections are unchanged
by this repair. Provider and shared credentials agree on current login/logout;
refresh changes stored tokens while provider continues to represent the same user.
AuthPages only navigates after successful login, so cancellation rejects that path.
A real LoginPage/router regression verifies no authenticated destination is reached
after logout at the validated-response boundary. No additional independent serious
defect was established within this focused scope; this is not a complete audit.

AuthProvider tests cover the original boundary, pending logout, validated-response
supersession, older success/failure after B succeeds, three concurrent attempts,
same-user logout/re-login, current success/failure, StrictMode unmount/remount,
no stale token/state/navigation commit, and real same-session refresh while another
login is pending. They assert stored credentials and rendered user state. Existing
26 Axios regressions preserve cross-account replay and refresh coverage.

Commands from frontend/ (final results; output logs under /tmp/devjobs-login-*):
- npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js:
  PASS, 37 tests (11 provider + 26 Axios); original baseline FAIL recorded above.
- npm test -- --run src/features/companies/discovery.test.jsx: PASS, 26 tests.
- npm test -- --run src/features/companies/CompanyPage.test.jsx: PASS, 15 tests.
- npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx: PASS, 24 tests.
- npm test -- --run src/components/templates/RecruiterLayout.test.jsx: PASS, 5 tests.
- npm run lint: PASS, including final added navigation test.
- npm test: PASS, 153 tests / 19 files on final source; existing non-failing JSDOM
  getComputedStyle pseudo-element diagnostics remain.
- npm run build: PASS; existing main-chunk advisory remains (757.69 kB).
Root git diff --check: PASS; git status --short inspected;
git diff --cached --stat: empty. One initial inspection referenced nonexistent
features/auth/pages/AuthPages.jsx; actual features/auth/AuthPages.jsx was read.

Files modified by this repair only: frontend/src/features/auth/AuthContext.jsx,
frontend/src/features/auth/api.js (pending-operation helpers only),
frontend/src/features/auth/AuthContext.test.jsx (original regression retained),
PROJECT_STATUS.md and docs/TESTING_STRATEGY.md (append only). Existing Stage 2B.1
work/security tests retained. LOCAL_DEVELOPMENT.md preserved, SHA-256
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
No public API/schema/migration/dependency/backend/production-settings changes.
Branch feat/admin-workspace-final; HEAD 6f4f6bab00f68aba9d558996d42f2e868255c3a7;
committed tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
No staging, commit, push, merge, deployment, PR #1 modification or remote action.
No backend/PostgreSQL/Docker/Chromium audit run. Independent full review,
disposable PostgreSQL, standalone/concurrent Chromium, exact staged-export checks
and hosted CI remain gates. Already-dispatched server requests are not undone by
client cancellation. Stage 2B.1 remains uncommitted; M-06 remains open (legacy
arrays, COUNT/deep-offset costs, concurrent-write drift). Stage 2B.2/2B.3 not started.


## Stage 2B.1 Gate 1 independent audit stop — 2026-11-14

FAIL; stopped on a serious cross-tab authentication identity-isolation defect.
Starting branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82. Baseline matches the requested values.
Working-tree status, diff summary and all untracked filenames inspected. Existing
Stage 2B.1 implementation/regressions and unrelated operations notes preserved.

Finding: auth/api.js observes localStorage replacement/storage events and rotates
its request generation, but AuthProvider initializes from readAuth only once and
listens only for devjobs:logout. A different same-origin tab logging in as B
changes shared credentials without updating A's mounted provider. The provider,
route guards and user-keyed recruiter boundaries continue representing A; newly
created requests capture B's generation and attach B's token. This permits A's
visible editor payload to be dispatched as B. Existing request-generation checks
correctly reject old requests but do not protect new requests from a stale UI
identity. No server permission bypass is asserted; a mutation can succeed if B
is authorized for its target. This also leaves prior-user UI state mounted.

Added one narrow regression in frontend/src/features/auth/AuthContext.test.jsx.
It uses the real AuthProvider, real HTTP interceptors, synthetic credentials and
a controlled Axios adapter. A minimal identity-owned editor is rendered as A;
shared storage is replaced with B plus a storage notification, simulating another
tab. Clicking the currently rendered editor (not a retained stale callback)
observes Authorization Bearer b-access with title 'a private draft'. The safety
assertion fails on exactly that combination. This is a deterministic JSDOM
reproduction, not a Chromium or full CompanyPage integration reproduction.
Implementation was not changed and existing assertions were not weakened.

Command from frontend/:
`npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js`
FAIL: 1 failed / 37 passed, 38 tests across 2 files; all prior 11 provider and
26 Axios tests pass. New provider regression fails on the actual header/payload.
Root `git diff --check`: PASS. Branch/HEAD/tree, git status --short and
`git diff --cached --stat` rechecked at delivery; index empty.

Review before stopping covered auth lifecycle/commit/refresh code, auth tests,
auth pages/routing, storage/HTTP consumers, recruiter identity boundaries and
membership/company code. Existing synchronous login commit and HTTP generation
checks do not resolve the reproduced provider/storage mismatch. All six repairs,
remaining recruiter consumers, React concurrent-rendering safety and complete
regression quality are NOT independently certified by this stopped audit.
Remaining requested discovery/CompanyPage/RecruiterPages/RecruiterLayout tests,
full frontend tests, lint and build were not run after the serious finding.

Follow-up: synchronize or invalidate mounted authentication consumers on external
session replacement/logout and ensure visible identity, private state and request
ownership agree before accepting another action. Preserve ordinary same-session
refresh behavior and add external logout/account-switch integration coverage.
Resume Gate 1 after repair; Gate 2 and subsequent disposable PostgreSQL,
standalone/concurrent Chromium, exact staged-export and hosted CI checks remain.
Stage 2B.1 remains uncommitted; M-06 remains open (legacy arrays, COUNT/deep-offset
costs and concurrent-write drift). Stage 2B.2 was not started.

Audit changes only: this append-only entry in PROJECT_STATUS.md and
 docs/TESTING_STRATEGY.md, plus the regression in AuthContext.test.jsx.
No API/schema/migration/dependency/backend/production-settings change.
LOCAL_DEVELOPMENT.md was not edited. No PostgreSQL, Docker, Chromium, database,
listener or remote operation performed. No staging, commit, push, merge,
deployment or PR #1 modification occurred.


## Security Repair 7 design-decision stop — 2026-11-14

FAIL / repair not implemented. The original cross-tab regression was preserved
unchanged and reproduced: A's rendered editor dispatches its private draft with
B's Authorization header. AuthProvider reads credentials only at initialization
and observes only same-document devjobs:logout. The HTTP proxy binds newly
initiated operations to current storage, without the initiating UI's ownership.
No backend authorization bypass is asserted.

Inspection also identified a cross-tab coordination constraint, distinct from
the reproduced regression. writeAuth synchronously writes the session marker and
credentials as separate localStorage operations. Refresh checks a process-local
generation before a separate read/merge/write; failure similarly checks before
clearing storage. Another document can write between those operations. This is a
static concurrency finding, not an additional controlled runtime reproduction.
The current generation includes token strings, so an external same-session token
refresh is also treated as a session change. A storage-event subscription alone
would neither close the pre-event initiation race nor serialize credential commits.
All production protected services inspected use the shared HTTP client;
plainHttp is used for refresh only. No subscription/epoch/dispatch repair is claimed.

Stopped at the request's explicit requirement to report before a broader
authentication-contract change. Proposed decision: replace split storage with
one credential/session-epoch record, preserving the epoch on refresh and replacing
it on login/logout, including same-user re-login. Serialize ALL credential writers
across documents (for example with a supported browser lock), revalidate ownership
inside that serialization boundary, and make the affected synchronous commit
lifecycle asynchronous. Browser-support/fail-closed behavior and existing-tab
migration must be specified. This is an internal browser lifecycle change, not a
proposal to change JWT endpoints or backend permissions. Owner approval requested;
no such change implemented. No sensitive event payloads or new dependencies added.

The eventual repair must bind requests to provider-owned session capabilities,
validate those capabilities at initiation and immediately before transport, and
retain ownership through refresh/retry. External adoption must validate identity
and remount account/session-specific state, including same-user re-login; external
logout must invalidate it. Token rotation within the same epoch must retain valid
operations. These are proposed guarantees, not verified behavior. Stale-editor
safety currently FAILS; cross-tab same-session refresh continuity is not repaired.

Commands run from frontend/ on unchanged implementation:
- npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js:
  FAIL, 37 passed / 1 failed (provider 11 passed / 1 failed; Axios 26 passed).
- npm test -- --run src/features/companies/discovery.test.jsx: PASS, 26 tests.
- npm test -- --run src/features/companies/CompanyPage.test.jsx: PASS, 15 tests.
- npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx: PASS, 24 tests.
- npm test -- --run src/components/templates/RecruiterLayout.test.jsx: PASS, 5 tests.
- npm run lint: PASS.
- npm test: FAIL, 153 passed / 1 failed, 19 files; same cross-tab regression.
  Existing JSDOM getComputedStyle pseudo-element diagnostics also appeared.
- npm run build: PASS; existing 757.69 kB main-chunk advisory remains.
Root git diff --check: PASS; git status --short inspected;
git diff --cached --stat: empty. Earlier six repairs' regression tests remain
passing; all seven repairs cannot be certified because repair 7 still fails.

Only PROJECT_STATUS.md and docs/TESTING_STRATEGY.md appended by this attempt.
All source/tests, prior Stage 2B.1 work and unrelated operations notes preserved.
LOCAL_DEVELOPMENT.md SHA-256 remains
6f241a47289e316ad893d3e153a9bf5bb1b7c89d8cc1d56c4a4561c04c881e60.
No API/schema/backend/production-settings/dependency changes.
Branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty.
Remaining gates: approved session design and repair, complete new cross-tab/race
regressions, independent review, disposable PostgreSQL, standalone/concurrent
Chromium, exact staged-export checks and hosted CI. No PostgreSQL, Docker or
Chromium run. Stage 2B.1 remains uncommitted; M-06 remains open (legacy arrays,
COUNT/deep-offset costs and concurrent-write drift). Stage 2B.2/2B.3 not started.
Nothing staged, committed, pushed, merged, deployed or changed in PR #1.


## Security Repair 7 canonical-session continuation — 2026-11-14

Owner approved Option 1: the external-tab regression now uses an independent
createSessionStore writer with shared storage/Web Locks and separate document
operation state. A remains mounted while B commits, before A receives a storage
notification. The real mounted editor first demonstrates A's actual bearer header
and JSON payload at the Axios adapter, then attempts its existing A draft after
B commits. That attempt must reject with ERR_CANCELED/sessionExpired before any
additional adapter dispatch. The explicit forbidden B-header/A-payload assertion
and regression remain; no test is deleted or skipped.

A separate legacy split-storage integration test proves legacy records alone
produce neither provider authentication nor a bearer header, and cannot replace
an established canonical A session or its dispatch ownership. Additional provider
tests verify external same-epoch token rotation preserves A's request payload
and uses the rotated token, and external replacement/logout remount private state.

Connected auth/api.js and AuthContext.jsx to the existing canonical session store.
All login/logout/refresh/expiry commits use the serialized canonical protocol;
request initiation uses the mounted provider's opaque capability, then actual
adapter dispatch revalidates it under a shared lock before reading the token.
Axios configuration preserves the opaque capability through retries. Provider
subscriptions reread current storage, epoch transitions remount private state,
and children mount after request ownership is installed. Login and logout are
asynchronous; existing authenticated test fixtures now await the canonical writer.
JSDOM uses a shared deterministic lock queue; native browser locking is not
claimed verified. Missing Web Locks fails closed for authenticated session work.
Legacy keys are deliberately ignored, so existing legacy sessions require login.
No new dependency, public HTTP API, schema, migration or backend/settings change
was made by this continuation. Existing unrelated working-tree changes remain.

Final commands from frontend/:
- npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js src/features/auth/sessionStore.test.js:
  PASS, 54 tests across 3 files.
- npm test: PASS, 170 tests across 20 files.
- npm run lint: PASS.
- npm run build: PASS; 761.80 kB main-chunk advisory remains.
Root git diff --check: PASS. Earlier intermediate integration runs failed and
were repaired before these final runs. Existing JSDOM pseudo-element
getComputedStyle diagnostics remain non-failing.

PROJECT_STATUS.md and docs/TESTING_STRATEGY.md updated with this result.
Focused verification is complete; independent review, native multi-tab browser
coverage, backend/PostgreSQL, standalone/concurrent Chromium, exact staged-export
and hosted CI gates have not been run by this continuation. Already dispatched
server requests cannot be undone by client cancellation. The in-memory JSDOM
scheduler checks protocol ordering, not browser implementation correctness.
Stage 2B.1 remains uncommitted; M-06 remains open; Stage 2B.2/2B.3 not started.
No staging, commit, push, merge, deployment, PR or remote action. Index remains
empty on feat/admin-workspace-final.


## Autonomous concurrent-edit recovery and authentication repair — 2026-11-14

PASS for the approved focused frontend repair. Stage 2B.1 remains uncommitted;
this does not certify its independent audit or release gates. M-06 remains open
(legacy arrays, COUNT/deep-offset costs and concurrent-write drift). Stage 2B.2
and 2B.3 were not started.

Safety investigation: captured SHA-256 and nanosecond modification times for
api.js, AuthContext.jsx, sessionStore.js and their three test files at four
snapshots separated by 10 seconds (30 seconds total). All were stable. Sandboxed
process inspection was denied; an approved read-only process listing succeeded.
Several long-lived Codex app servers and the code-mode host were present, but no
active conflicting file writer was evident. Stable hashes are not proof of
exclusive access. All six source/test hashes and both documentation hashes were
rechecked before every edit and again after verification. No unexpected changes
were observed; no processes were terminated. Existing Stage 2B.1 work and all
unrelated operations notes were preserved.

Reconciliation retained the existing canonical sessionStore implementation,
opaque WeakMap-backed permits, locked pending-login ownership, token revisions,
AuthProvider synchronization and Axios request ownership. No second session
ownership mechanism was added. One incomplete boundary was repaired: refresh
requests now revalidate the originating permit and token revision under a shared
Web Lock at actual refresh transport dispatch, after asynchronous interceptors.
A delayed-refresh regression proves replacement login prevents that transport
from receiving old refresh credentials. Existing security assertions were not
weakened. Added unsupported-lock authenticated-dispatch, pending-transport lock
release and identical-user external replacement/remount coverage.

Final architecture and guarantees:
- One persisted record, devjobs.auth.v2, contains schema, epoch, revision,
  credentials and pendingLogin. Legacy devjobs.auth/devjobs.auth.session values
  are never imported or accepted as canonical ownership. Existing legacy sessions
  require a new login in the updated client. Old clients do not participate in
  the new protocol; no control over already-running legacy code is claimed.
- All cooperating updated documents use the same native Web Locks name.
  Exclusive locks serialize login ownership writes, credential commits, logout,
  refresh persistence and expiry; validation occurs inside the lock. localStorage
  is a record store, not a compare-and-swap or locking primitive.
- Login/logout rotate epochs, including identical-user re-login. Refresh retains
  the epoch and increments the credential revision. A pending login keeps current
  session requests usable. Competing login attempts share canonical ownership;
  canceled/unmounted/stale attempts cannot commit a replacement session.
- AuthProvider rereads storage on notifications rather than trusting event data;
  same-document writes notify subscribers too. Epoch changes remount the private
  subtree, including same-user replacement and external logout. Same-epoch token
  rotation retains the mounted identity and private state.
- Mounted provider ownership binds new requests before Axios interception.
  Opaque permits survive Axios config cloning. Initiation, request interception,
  transport dispatch, refresh dispatch/commit, response completion and retry
  validate session ownership. Shared dispatch locks exclude credential writers
  until the actual transport is invoked and its bearer token is selected.
  Locks are released while network responses are pending, so refresh/logout
  cannot deadlock behind a pending request. Replacement tokens are never attached
  to an obsolete request. Obsolete completions reject with ERR_CANCELED and
  sessionExpired=true. Already-dispatched server effects cannot be undone.
- Without Web Locks, credential writes and authenticated dispatch fail closed;
  no localStorage spin-lock or insecure fallback is used. Storage denial or
  malformed canonical records do not import legacy credentials. Public requests
  remain unauthenticated. This requires supported secure-context browser Web
  Locks for authenticated operation; no browser-support expansion is claimed.

All seven regression areas pass: membership A -> B -> A, CompanyPage cross-user
permissions, CompanyJobsList private drafts, CompanyDirectory memberships, Axios
cross-session replay, AuthProvider stale login completion and cross-tab stale
editor mutation. The cross-tab editor regression retains real action and actual
header/payload assertions; its external-tab setup uses a second canonical store
with independent operation state. A separate legacy split-storage test remains.

Exact final commands from frontend/:
- npm test -- --run src/features/auth/sessionStore.test.js: PASS, 15 tests / 1 file.
- npm test -- --run src/features/auth/AuthContext.test.jsx src/features/auth/api.test.js:
  PASS, 43 tests / 2 files (16 provider, 27 Axios).
- npm test -- --run src/features/companies/discovery.test.jsx: PASS, 26 tests.
- npm test -- --run src/features/companies/CompanyPage.test.jsx: PASS, 15 tests.
- npm test -- --run src/features/jobs/pages/RecruiterPages.test.jsx: PASS, 24 tests.
- npm test -- --run src/components/templates/RecruiterLayout.test.jsx: PASS, 5 tests.
- npm run lint: PASS.
- npm test: PASS, 174 tests / 20 files. Existing non-failing JSDOM
  getComputedStyle pseudo-element diagnostics remain.
- npm run build: PASS; existing main-chunk advisory remains (762.00 kB).
Root git diff --check: PASS; git status --short inspected;
git diff --cached --stat: empty. Focused/full logs are under
/tmp/devjobs-recovery-{discovery,company,recruiter,layout,full}.log.

Recovery edited only frontend/src/features/auth/api.js, api.test.js,
AuthContext.test.jsx, sessionStore.test.js and appended PROJECT_STATUS.md and
 docs/TESTING_STRATEGY.md. Existing AuthContext.jsx/sessionStore.js implementation
and other frontend/backend/docs changes were retained. No dependency, public API,
backend contract, schema, migration or production-settings change was made.

Native multi-document Web Locks/transport behavior is not runtime-certified by
JSDOM's deterministic scheduler. Independent full review, disposable PostgreSQL,
standalone/concurrent Chromium, exact staged-export verification and hosted CI
remain gates. No PostgreSQL, Docker or Chromium command was run during recovery.

Repository identity: branch feat/admin-workspace-final; HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7; committed tree
2112fb7ec4d5a93e2f5f882eda877d778afaea82; index empty. No staging, commit, push,
merge, deployment, PR #1 modification or remote action occurred.


## Resumed Stage 2B.1 Gate 1 independent audit — 2026-11-14

**FAIL; stopped on a deterministic provider-lifetime vulnerability.** Existing
implementation and both interrupted E2E files were preserved. Only one regression
was added to frontend/src/features/auth/AuthContext.test.jsx, and this entry
appended to PROJECT_STATUS.md and docs/TESTING_STRATEGY.md. No production source,
API, schema, migration, dependency or settings changes.

Finding: SessionProvider.login captures lifecycle.current when invoked, rather
than enforcing that its originating provider remains mounted. Cleanup increments
the counter and cancels the existing attempt, but a retained callback invoked
after cleanup captures the incremented value, begins a new operation against the
current canonical epoch and can commit successfully. The regression renders A,
retains its actual context.login, commits and renders B (confirming the callback
changed), then invokes the obsolete callback with synthetic A credentials.
Actual Axios adapter dispatch records POST /auth/login/ with A's login payload;
the result succeeds, canonical B is replaced by A and the UI renders A. Expected
behavior is sessionExpired/ERR_CANCELED, no transport and unchanged B. This is
a provider/API integration regression with a controlled adapter, not a claimed
native-browser exploit or server authorization bypass. No stale A-payload/B-token
mutation was observed in this regression. Retained authentication callbacks
need lifetime ownership even when invoked after unmount; fixing only pending
operations is insufficient. Implementation intentionally left unchanged under
the owner's serious-vulnerability stop instruction.

Recovered interrupted-run evidence: /tmp/devjobs-gate1-browser.log is complete,
not an unknown/in-progress result. Run 4478f58d3de849c799a67e3f2c79b7c4 used owned
container 397b48e5c6db, cluster 7708000011796447277, PostgreSQL 17 database
devjobs_e2e_disposable on ephemeral port 55508. Migrations, system check and
migration consistency PASS; pytest 171 passed / 8 skipped (40.45s).
Chromium executed two tests: cross-tab PASS (7.7s); role workflow FAIL (33.9s),
total 42.3s. Failure occurs at admin login, workflows.spec.js:234; retained error
context reports authentication throttling with 25 seconds remaining. No throttle
configuration was changed. No fresh browser/container run was started after the
serious finding; these are recovered results, not rerun certification.

Cross-tab spec review: both pages use one browser context and real shared
localStorage/native Web Locks. A's capture listener queues canonical storage
notifications before the application receives them; the test waits for a queued
event and confirms shared storage already contains B while A's draft remains.
Real PATCH headers/payloads are checked by a positive A control, no subsequent A
draft transport, and B's successful own mutation on a shared authorized object.
Releasing notifications checks remount/private-state invalidation. Refresh keeps
the epoch/draft. Concurrent refresh routing holds both transports until both
arrive; one successful request and one cancellation, a single revision increment
and both documents' recovery are asserted. It does not force a particular
response to win or independently control late-failure-after-winning-commit
ordering. Same-user replacement, external logout/re-login and unavailable locks
are included. Legacy storage rejection is covered by unit integration tests,
not this browser spec. Browser coverage is therefore not comprehensive.

Review inspected exclusive canonical writes/shared transport dispatch locking,
opaque permits, provider synchronization, refresh dispatch/commit/retry revision
checks and recruiter callbacks. Job mutation callbacks use unmount lifetime
guards; CompanyPage uses authorization guards. The mounted-owner mechanism does
not make an obsolete AuthProvider login callback safe. Full independent review
certification stops at the reproduced defect.

Seven existing regression areas in the full frontend run:
1. Membership A -> B -> A: existing regressions pass.
2. CompanyPage cross-user permissions/retained callbacks: existing regressions pass.
3. CompanyJobsList private drafts: existing regressions pass.
4. CompanyDirectory memberships: existing regressions pass.
5. Axios cross-session replay/refresh ownership: existing regressions pass.
6. AuthProvider stale login completion: prior tests pass, new post-remount
   invocation regression FAILS.
7. Cross-tab stale editor mutation: existing unit regression passes; recovered
   native-browser scenario passes with the ordering limits above.
Passing tests do not override the new lifecycle defect.

Commands run during this resumed audit:
- frontend/: npm test -- --run src/features/auth/AuthContext.test.jsx:
  FAIL, 16 passed / 1 failed (17 tests), repeated after diagnostic-only assertion
  refinement with the same result; final log /tmp/devjobs-gate1-resumed-provider.log.
- frontend/: npm test > /tmp/devjobs-gate1-resumed-full.log 2>&1:
  FAIL, 174 passed / 1 failed, 20 files. Only the new regression fails.
- frontend/: npm run lint: PASS.
- frontend/: npm run build > /tmp/devjobs-gate1-resumed-build.log 2>&1: PASS;
  existing chunk-size advisory remains.
- root: git diff --check: PASS.
- Read-only process inventory and docker ps -a --filter label=devjobs.e2e:
  no interrupted runner, pytest, Playwright, owned API/Vite service or labeled
  container remains. Recovered log reports successful cleanup; private temporary
  directory devjobs-e2e-8576a4xf is absent. Failure screenshots/context under the
  run-specific results directory are retained as evidence. No process/container
  was stopped or removed by this continuation. Development PostgreSQL 17/18 and
  Vite processes were left alone; development databases and devjobs_test were
  not accessed.

Branch feat/admin-workspace-final and HEAD
6f4f6bab00f68aba9d558996d42f2e868255c3a7 unchanged; index empty.
Working tree retains all 25 modified tracked and 7 untracked paths.
Stage 2B.1 remains uncommitted. No staging, commit, push, merge, deployment or
PR #1 change. Resume Gate 1 after lifecycle repair; Gate 2 remains pending,
including remaining independent acceptance review, clean standalone/concurrent
isolated Chromium, exact staged-export verification when authorized and hosted
CI. M-06 remains open; Stage 2B.2 was not started.


## Stage 2B.1 resumed final verification — 2026-11-15

**PASS for working-tree Gate 1; recommend Gate 2 staged-snapshot verification.**
Recovered complete hardening logs and independent Playwright .last-run.json
artifacts (status passed, failedTests empty) for all three runs. Completed tests
were not restarted. This continuation changed only this documentation and
PROJECT_STATUS.md; existing implementation and unrelated operations notes retained.

Authentication review confirms originating layout-effect lifetime objects become
permanently dead on cleanup, cancel pending login and revoke request permits.
Retained login/logout callbacks assert their original live owner; Strict Mode
setup creates a new owner. Generation checks supersede older attempts before
lock acquisition; actual login dispatch validates again after interceptors.
Canonical devjobs.auth.v2 epochs, locked pending-login ownership, revision-checked
refresh dispatch/commit/expiry, opaque initiating request permits and shared
transport locks prevent obsolete attempts/requests using replacement credentials.
Missing Web Locks reject credential writes/authenticated dispatch. No material
security issue found in the reviewed boundaries. All original seven regression
areas pass: membership A/B/A, CompanyPage permissions, private job drafts,
directory membership, Axios replay/refresh, provider stale login and cross-tab
stale editor mutation. Multi-page company lookup now captures one initiating
ownership; the earlier failing review-regression log predates its repair and the
passing final auth/full logs.

Recovered commands/results (run on November 14):
- frontend: npm test — PASS, 184 tests / 20 files
  (/tmp/devjobs-hardening-full.log).
- frontend: npm test -- --run src/features/auth/AuthContext.test.jsx
  src/features/auth/api.test.js src/features/auth/sessionStore.test.js — PASS,
  68 tests / 3 files (/tmp/devjobs-hardening-auth.log).
- frontend: npm test -- --run src/features/companies/discovery.test.jsx
  src/features/companies/CompanyPage.test.jsx
  src/features/jobs/pages/RecruiterPages.test.jsx
  src/components/templates/RecruiterLayout.test.jsx — PASS, 70 tests / 4 files
  (/tmp/devjobs-hardening-integration.log).
- frontend: npm run build — PASS (/tmp/devjobs-hardening-build.log).
- backend/.venv/bin/python backend/run_browser.py — PASS, PostgreSQL 17:
  171 passed / 8 skipped (179 collected, 38.58s), Chromium 3/3 (1.2m).
  Run 783a2bba7ed645f58209b89362bc45e3; container 959da4c41850;
  cluster 7708052352626552877; /tmp/devjobs-hardening-browser.log.
- backend/.venv/bin/python backend/run_browser_concurrent.py — both PASS.
  Runner 1: 0920bfb6837e49efa1794bf3210d9049, container 46cfed3a08a0,
  cluster 7708052700176879661. Runner 2:
  bf191b6394564577a0cf84df8584c520, container 9ffede27e4bf,
  cluster 7708052700135534637. Each: 171 passed / 8 skipped (179 collected,
  40.09s); peer service/cluster isolation PASS; Chromium 3/3 (1.2m).
  /tmp/devjobs-hardening-concurrent.log contains both completion and cleanup lines.
- Each Chromium execution passes native cross-tab security, Strict Mode provider
  lifetime/queued transport and candidate/recruiter/admin workflow scenarios.
  Zero unexpected browser errors. Workflow honors server Retry-After without
  changing throttle configuration. All runners applied migrations, passed Django
  system checks and reported no migration changes against their owned databases.

Commands run in this continuation:
- frontend: npm run lint — PASS.
- backend/.venv/bin/ruff check backend — PASS.
- backend/.venv/bin/ruff format --check
  backend/config/collection_pagination_tests.py backend/config/e2e_safety.py
  backend/config/test_e2e_safety_unit.py — PASS, 3 files.
- backend/.venv/bin/ruff format --check --config backend/ruff.toml
  /tmp/devjobs-2b1-format.py — PASS; extracted changed recruiter view/filter
  matches current source; historical surrounding formatting retained.
- /tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py — PASS:
  OpenAPI 3.1, 39 paths / 55 operations, six serializer sets, 3 negative controls.
- Read-only ps inventory and docker ps -a --filter label=devjobs.e2e — PASS:
  no runner-owned process/container. Private devjobs-e2e/devjobs-concurrent
  temporary directories absent. Run-specific result directories are retained
  evidence, not live resources. No existing development service was stopped.
- git diff --check and git diff --cached --quiet — PASS; index empty.
  git branch --show-current: feat/admin-workspace-final.
  git rev-parse HEAD: 6f4f6bab00f68aba9d558996d42f2e868255c3a7.
  git rev-parse 'HEAD^{tree}': 2112fb7ec4d5a93e2f5f882eda877d778afaea82.
  git status --short, git diff --name-only and
  git ls-files --others --exclude-standard inspected.

Limits: 8 optional Redis tests skipped per PostgreSQL run; these are not claimed
passed. Chromium only; secure-context native Web Locks required. Native refresh
coverage does not force every late-response ordering; deterministic regressions
cover additional orderings. Already-dispatched server effects cannot be undone.
Existing JSDOM/Ant Design diagnostics and 762.49 kB bundle advisory remain.
Full tests/build and browser results are recovered, not rerun today; source
mtime inspection found no later frontend production/unit changes. Later browser
fixture and safety changes are covered by the completed concurrent run.
Gate 2 exact snapshot and hosted CI remain pending; M-06 limitations remain.
No dependency, production-settings, API or schema change in this continuation.
No staging, commit, push, merge, deployment or PR #1 modification. Stage 2B.2
not started.

Modified tracked paths (27):
```text
PROJECT_STATUS.md
backend/apps/recruiters/api.py
backend/config/collection_pagination_tests.py
backend/config/e2e_safety.py
backend/config/test_e2e_safety_unit.py
docs/API_CONVENTIONS.md
docs/LOCAL_DEVELOPMENT.md
docs/TESTING_STRATEGY.md
docs/openapi.yaml
frontend/e2e/workflows.spec.js
frontend/src/components/templates/RecruiterLayout.jsx
frontend/src/components/templates/RecruiterLayout.test.jsx
frontend/src/features/auth/AuthContext.jsx
frontend/src/features/auth/AuthPages.test.jsx
frontend/src/features/auth/api.js
frontend/src/features/auth/api.test.js
frontend/src/features/companies/CompanyPage.jsx
frontend/src/features/companies/CompanyPage.test.jsx
frontend/src/features/jobs/pages/CompanyDirectory.jsx
frontend/src/features/jobs/pages/JobsPages.test.jsx
frontend/src/features/jobs/pages/RecruiterPages.jsx
frontend/src/features/jobs/pages/RecruiterPages.test.jsx
frontend/src/features/jobs/services/api.js
frontend/src/features/jobs/services/api.test.js
frontend/src/features/resumes/ResumePage.test.jsx
frontend/src/features/resumes/api.test.js
frontend/src/test/setup.js
```

Untracked individual files (9):
```text
frontend/e2e/auth-cross-tab.spec.js
frontend/e2e/fixtures/provider-lifetime.jsx
frontend/e2e/provider-lifetime.spec.js
frontend/src/features/auth/AuthContext.test.jsx
frontend/src/features/auth/sessionStore.js
frontend/src/features/auth/sessionStore.test.js
frontend/src/features/companies/CompanyPicker.jsx
frontend/src/features/companies/discovery.test.jsx
frontend/src/features/companies/useCompanyMembership.js
```


## Stage 2B.1 Gate 2 exact snapshot procedure — 2026-11-15

Gate 2 audits the authorized company discovery implementation, authentication
repairs, regression/browser tests and API/testing documentation. The baseline is
feat/admin-workspace-final at 6f4f6bab00f68aba9d558996d42f2e868255c3a7,
tree 2112fb7ec4d5a93e2f5f882eda877d778afaea82, initially empty index.
The four unrelated local operations sections in PROJECT_STATUS.md and all
uncommitted LOCAL_DEVELOPMENT.md operations notes are excluded through index-only
staging; their working-tree bytes are preserved. No schema, migration, dependency
or production-settings changes are included.

Verification uses git archive of git write-tree, locked npm ci dependencies,
frontend lint/unit/build, backend Ruff/changed-code format, OpenAPI validation,
pure runner safety tests and standalone plus concurrent disposable PostgreSQL 17
and Chromium runners. All project code comes from the export. Existing backend
installed packages may be reused. Tree hashes, actual results and local commit
identity are recorded in the delivery report outside the tested tree to avoid
changing the snapshot after verification. Commit is conditional on every required
check passing and the index still matching the tested tree. No push, merge,
deployment or PR operation is authorized.

Security review covers originating provider lifetimes and retained callbacks,
canonical ownership, serialized credential writes, missing-lock rejection, stale
login/refresh cancellation, request initiation/dispatch/retry, membership A/B/A,
private drafts, stale editors and legacy storage rejection. Native browser refresh
coverage explicitly selects each document as winner with late success and late
failure; deterministic unit regressions cover both commit orders. These are
bounded regression guarantees, not exhaustive concurrency certification.
Secure-context Web Locks and Chromium remain required verification boundaries;
eight optional Redis tests may skip. Already-dispatched server effects cannot
be undone. M-06 remains open; Stage 2B.2 is not started.


## Stage 2B.1 Gate 2 exact snapshot result — 2026-11-15

**FAIL; no commit created.** Tested staged tree
59232ebfabfb0ca2dd6b257250bc5779bc7817d2 was exported with git archive.
35 authorized paths staged; LOCAL_DEVELOPMENT.md excluded entirely and four
PROJECT_STATUS local operations sections excluded in two diff hunks. Original
work preserved. This result is an unstaged append after testing; it is not part
of the tested tree and must be included in any rebuilt snapshot before a future
commit. Branch/HEAD remain the expected feat/admin-workspace-final /
6f4f6bab00f68aba9d558996d42f2e868255c3a7.

Fresh exported-source verification: npm ci, lint, 184 frontend tests / 20 files,
build, Ruff, three changed Python files plus extracted recruiter view/filter
format, OpenAPI 39 paths / 55 operations / three negative controls and 16 runner
safety tests PASS. Initial pure safety invocation was denied loopback sockets by
the sandbox; approved rerun passed. Initial OpenAPI invocation lacked exported
backend/.venv; linking the permitted installed dependency environment corrected
the harness setup without changing any exported source.

Standalone owned PostgreSQL 17: 171 passed / 8 optional Redis skipped; Django
check and migration consistency PASS; Chromium 3/3 PASS. Concurrent runners each
passed PostgreSQL 171/8, Django/migrations and peer service/cluster/credential
isolation. Runner c645570f0f494f519d62e92afae7a043 Chromium 3/3 PASS. Runner
b7d4116b9caa4dac8225767281a43249 Chromium 2 passed / 1 failed: native cross-tab
and retained-provider lifetime regressions PASS, role workflow FAIL at admin
login (workflows.spec.js:248). waitForResponse and form-button click at lines
44/45 timed out after 10000ms. Admin failure screenshot shows the preceding
429 with 25 seconds remaining. Helper honors Retry-After; evidence does not
explain why the subsequent form-button lookup/response failed. A specific
product defect or complete root cause is not established. No test or throttle
policy was weakened, and no retry was used to erase the failure.

Evidence: /tmp/devjobs-gate2-{frontend-tests,build,browser,concurrent}.log,
/tmp/devjobs-gate2-reviewed-staged.diff, export manifest and archive, and
/tmp/devjobs-e2e-b7d4116b9caa4dac8225767281a43249-results/. All three owned
containers cleaned; Docker inventory retains only the original stopped welcome
container. Final resource/hash verification is recorded in the delivery report.
No development database, schema, dependencies or production settings were
changed. Index remains staged for review; no commit/push/merge/deployment/PR
operation occurred. M-06 remains open; Stage 2B.2 not started.


## Stage 2B.1 Gate 2 login blocker repair — 2026-11-15

The starting index was verified as tree
59232ebfabfb0ca2dd6b257250bc5779bc7817d2, 35 authorized paths on
feat/admin-workspace-final at 6f4f6bab00f68aba9d558996d42f2e868255c3a7.
The earlier failed Gate 2 result above is retained and included in the rebuilt
snapshot. Four unrelated PROJECT_STATUS operations sections and all local
LOCAL_DEVELOPMENT notes remain excluded through index-only staging.

The quota response is expected policy: the cross-tab scenario makes two logins,
then the role workflow makes four. All are anonymous requests from 127.0.0.1;
separate browser contexts/accounts do not create separate client-IP quotas.
The sixth request within 60 seconds exceeds 5/minute. Each runner has a separate
backend process and process-local cache, independent UUID accounts, database,
ports and browser contexts. Production Redis is not used by these E2E settings;
there is no demonstrated cross-run cache or credential leak.

A controlled Chromium regression holds the real Ant Design loading-icon leave
transition across a 429. The button's native accessible name is then
"loading Log in", although its visible text is "Log in". The old exact-name
selector fails after the quota wait and its unobserved response promise also
times out. The control run reproduces this failure (11.8s), and the old helper's
role workflow fails again at admin login. An initial diagnostic run passed,
confirming the renderer timing is intermittent. The historical failed run had
no accessibility trace: its exact renderer schedule cannot be reconstructed.
This is a demonstrated helper defect, not a proven production login defect.
Control evidence: /tmp/devjobs-login-red.log and preserved old helper
/tmp/devjobs-login-red-helper.js; diagnostic: /tmp/devjobs-login-investigate.log.

The shared E2E helper now selects the form's submit button independently of its
decorative icon and waits for visibility, enabled state and React's non-loading
class. Click and matching POST response are observed together with Promise.all.
Only one bounded retry is allowed, using precisely the server's Retry-After;
there is no arbitrary padding or enlarged action/scenario timeout. It checks
that the original URL, document and anonymous session record survive the wait,
and verifies the final account identity as well as the workspace menu.
No production/frontend application source, throttle policy, runner architecture,
API, schema, migration or dependency change is required by this repair.

Regression coverage adds native 429/held-icon retry with a real admin login,
retry cancellation on navigation, anonymous session replacement and context
closure, plus a component test for anonymous credentials, retained form values,
idle submit state and no automatic resubmission after admin 429. Existing
cross-tab, provider-lifetime, company-discovery and role assertions remain.
Focused AuthPages command: npm test -- --run
src/features/auth/AuthPages.test.jsx — PASS, 8 tests. Frontend ESLint PASS.
An initial npm run lint from repository root failed ENOENT; the correct frontend
working directory passed. Browser and exact-snapshot acceptance results are
recorded in the delivery report, outside the tested tree, to keep its identity
stable. No check is accepted merely because the earlier snapshot passed.

The rebuilt staged tree must be exported using git archive and verified with
fresh npm ci, full frontend tests/lint/build, backend Ruff/changed-code format,
OpenAPI, 16 pure runner safety tests, standalone owned PostgreSQL 17/Chromium,
and three complete fresh concurrent pairs with peer rejection. Commit is
conditional on every required check passing and an unchanged tested index.
Only the requested local commit is authorized; no push, merge, deployment or PR
operation. Chromium/native Web Locks remain the boundary; optional Redis tests
may skip, hosted CI is pending, and repeated passes are bounded evidence rather
than a proof of race freedom. M-06 remains open. Stage 2B.2 is not started.
