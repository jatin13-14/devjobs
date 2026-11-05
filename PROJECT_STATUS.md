# Project status

**Status:** v0.1.0 foundation and local PostgreSQL verification complete; hosted CI pending workflow publication
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
| 0 | Repository, conventions, docs, CI baseline | Local setup and PostgreSQL checks verified; workflow files exist locally, hosted CI not yet registered |
| 1 | Auth, roles and profiles | Not started |
| 2 | Companies and recruiter membership | Not started |
| 3 | Job creation and publishing | Not started |
| 4 | Job discovery and filters | Not started |
| 5 | Resume and applications | Not started |
| 6 | Recruiter applicant workflow | Not started |
| 7 | Admin moderation | Not started |
| 8 | Security, accessibility, regression and deployment | Not started |

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
- PostgreSQL is configured and was verified locally against PostgreSQL 18.3; the hosted workflow is configured to use PostgreSQL 17 and remains unverified.
- GitHub reports zero registered workflows and zero workflow runs for the repository. The local workflow files are untracked and absent from the latest `main` commit; publishing them in a push or pull request is required to trigger hosted CI.

## Foundation verification (2026-11-05)
- Final local rerun: in `frontend/`, `npm run lint`, `npm test` (1 test), and `npm run build` all passed. Vite 6.4.5 reports a 609.25 kB minified JavaScript chunk, above its 500 kB advisory threshold.
- Final local rerun: in `backend/`, `.venv/bin/python manage.py check`, `.venv/bin/python manage.py makemigrations --check --dry-run`, `.venv/bin/python -m pytest` (2 tests), and `.venv/bin/ruff check .` all passed under Python 3.14.4 and Django 5.2.19. A fresh in-memory SQLite `migrate --noinput` applied all migrations successfully, including `accounts.0001_initial`.
- The custom `accounts.User` uses email login and a UUID primary key. Its initial migration exists, matches the model, and applied with all Django migrations on a fresh in-memory SQLite database.
- PostgreSQL connection was verified using `DATABASE_URL=postgresql://devjobs:devjobs@127.0.0.1:5432/devjobs`; Django selected `django.db.backends.postgresql` and connected to PostgreSQL 18.3 as user/database `devjobs` at `127.0.0.1:5432`.
- Production settings require explicit non-placeholder `DJANGO_SECRET_KEY` and `DJANGO_ALLOWED_HOSTS` values.
- Frontend build emits a 609.25 kB minified JavaScript chunk, above Vite's 500 kB advisory threshold.
- Local CI workflow files in `.github/workflows/frontend.yml` and `backend.yml` declare push and pull request events with path filters; backend CI provisions PostgreSQL 17 and runs Django checks, migration consistency/application, tests, and Ruff. GitHub API checks on 2026-11-05 returned zero registered workflows and zero runs; `git ls-tree` confirms the workflow files are absent from `main`'s latest commit. Commit and push the workflow files or open/update a PR containing them to trigger CI.
- `git diff --check` passed. A scan of tracked files found no apparent real secrets or credentials; `.env.example` contains documented local-only placeholders (`devjobs` database credentials and replacement secret text). `.env` and `frontend/.env` are ignored.
- Live PostgreSQL checks passed locally against PostgreSQL 18.3: Django system check, migration consistency, full migrations, 2 backend tests, and Ruff. Hosted PostgreSQL 17 CI remains unverified until the workflow files are published.
