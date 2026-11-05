# Project status

**Status:** v0.1.0 foundation and local PostgreSQL verification complete; hosted CI passed for PR #1
**Product version:** 0.1.0 (pre-release planning baseline)  
**Last updated:** 2026-11-05

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
- UUID primary keys are proposed for externally exposed entities beyond the UUID-based `User` model.
- Initial hosting and production storage provider are not finalized.

## Delivery phases
| Phase | Scope | Status |
|---|---|---|
| 0 | Repository, conventions, docs, CI baseline | Local setup and PostgreSQL checks verified; both hosted workflows passed on `ae02cd75182da08a7557289a6d26ede194a710d5` |
| 1 | Auth, roles and profiles | Not started |
| 2 | Companies and recruiter membership | Not started |
| 3 | Job creation and publishing | Not started |
| 4 | Job discovery and filters | Not started |
| 5 | Resume and applications | Not started |
| 6 | Recruiter applicant workflow | Not started |
| 7 | Admin moderation | Not started |
| 8 | Security, accessibility, regression and deployment | Not started |

## Authentication foundation review (2026-11-05)
- Email addresses are stored trimmed and case-folded in full; manager authentication and JWT issuance normalize inputs with the same policy. Existing account emails are normalized by migration `accounts.0002_normalize_existing_emails`; it aborts before updates if case-insensitive duplicates need manual resolution.
- Django superusers use the product `admin` role and retain Django's required `is_staff=True` and `is_superuser=True` invariants. This does not implement role-aware onboarding or other Phase 1 features.
- Production HTTPS redirect, HSTS, and trusted reverse-proxy scheme handling are environment-configurable and remain disabled by default for redirects/HSTS and in local development. See `docs/LOCAL_DEVELOPMENT.md` for TLS proxy requirements.
- PR #1 contains the review fixes. The current head is `ae02cd75182da08a7557289a6d26ede194a710d5`; backend and frontend GitHub Actions passed on that commit. PR #1 remains unmerged.

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
- PostgreSQL is configured and was verified locally against PostgreSQL 18.3. The backend hosted workflow uses PostgreSQL 17 and passed on the commit listed above.

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
- Current GitHub state for PR #1: head `ae02cd75182da08a7557289a6d26ede194a710d5`; backend workflow run [42062870540](https://github.com/jatin13-14/devjobs/actions/runs/42062870540) passed and frontend workflow run [42062870578](https://github.com/jatin13-14/devjobs/actions/runs/42062870578) passed on that exact commit.
- The older notes below and above that say workflows were unregistered, hosted runs were pending, or no commit/push had occurred describe earlier snapshots and are retained as historical records. They are superseded by this current state. PR #1 is not merged.
