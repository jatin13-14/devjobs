# DevJobs

A global job marketplace for software developers, initially focused on IT, AI and full-stack roles.

## Product and engineering baseline
- Frontend: React + Vite (JavaScript)
- UI: Ant Design with a documented design-token layer
- Frontend architecture: feature-based folders with atomic UI composition
- Backend: Django + Django REST Framework
- Database: PostgreSQL
- Authentication: JWT with role-based authorization
- Initial architecture: modular monolith
- Version control: Git, semantic versioning, conventional commits

## Current phase
Foundation and discovery. No application feature is considered implemented until it exists in the repository and passes its documented checks.

## Quick links
- [Project status](PROJECT_STATUS.md)
- [Product requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [API conventions](docs/API_CONVENTIONS.md)
- [UI system](docs/UI_DESIGN_SYSTEM.md)
- [Testing strategy](docs/TESTING_STRATEGY.md)
- [Versioning and Git workflow](docs/VERSIONING_AND_GIT.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Decision records](docs/adr/)

## Local setup
See [local development setup](docs/LOCAL_DEVELOPMENT.md) for prerequisites, PostgreSQL setup, environment variables, dependency installation, startup and verification commands. Do not copy real credentials into source control. Use `.env.example` for local defaults and keep the ignored `.env` file local.

## Foundation verification
PR #1 is open and unmerged. Its latest verified head is `d048b1720602bcbe19c78d3725a9c07c900e4ce4`; [backend verification #9](https://github.com/jatin13-14/devjobs/actions/runs/42076673522) and [frontend verification #6](https://github.com/jatin13-14/devjobs/actions/runs/42076673521) both passed on that head. See [project status](PROJECT_STATUS.md) and [local development](docs/LOCAL_DEVELOPMENT.md) for local checks and results.

## Project principles
1. Ship a secure, coherent MVP before adding AI features.
2. Prefer a modular monolith over premature microservices.
3. Keep API contracts and UI patterns documented.
4. Every feature includes tests, review and acceptance checks.
5. Never mark work complete based only on generated code; run it and verify it.
