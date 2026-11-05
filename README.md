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
Setup commands will be added after the repository's actual runtime versions and deployment target are confirmed. Do not copy secrets into source control. Use `.env.example` as the documented variable contract.

## Project principles
1. Ship a secure, coherent MVP before adding AI features.
2. Prefer a modular monolith over premature microservices.
3. Keep API contracts and UI patterns documented.
4. Every feature includes tests, review and acceptance checks.
5. Never mark work complete based only on generated code; run it and verify it.
