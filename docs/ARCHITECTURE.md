# Architecture

## 1. Architectural style
Start with a modular monolith. Keep domain boundaries clear without network boundaries or distributed infrastructure until scale and operational needs justify them.

## 2. Proposed repository layout
```text
devjobs/
  AGENTS.md
  PROJECT_STATUS.md
  docs/
    PRODUCT_REQUIREMENTS.md
    ARCHITECTURE.md
    DATA_MODEL.md
    API_CONVENTIONS.md
    UI_DESIGN_SYSTEM.md
    TESTING_STRATEGY.md
    VERSIONING_AND_GIT.md
    DEVELOPMENT_WORKFLOW.md
    adr/
  frontend/
    src/
      app/
      components/
        atoms/
        molecules/
        organisms/
        templates/
      features/
      hooks/
      lib/
      styles/
      test/
  backend/
    config/
    apps/
      accounts/
      candidates/
      recruiters/
      companies/
      jobs/
      applications/
      moderation/
    tests/
  .github/workflows/
```

## 3. Frontend boundaries
- `app/`: routing, providers and app bootstrap.
- `components/atoms`: design-system primitives.
- `components/molecules`: small combinations such as form fields and search controls.
- `components/organisms`: job cards, navigation and dashboards.
- `components/templates`: page-level layout composition.
- `features/`: domain-specific screens, state and API hooks.
- `lib/`: API client, auth utilities and shared helpers.
- `styles/`: tokens, global styles and theme configuration.

Do not force every component into atomic folders. Domain-specific components belong with their feature unless they are genuinely reusable.

## 4. Backend boundaries
- `accounts`: custom user model, authentication and role primitives.
- `candidates`: candidate profile and skills.
- `recruiters`: recruiter profile and membership workflows.
- `companies`: company profile and verification state.
- `jobs`: job lifecycle, publishing and search filters.
- `applications`: application submission, status and history.
- `moderation`: admin review and audit actions.

Use serializers for transport validation, permission classes for access policy, service functions for multi-model business workflows, and querysets/selectors for reusable read logic.

## 5. Request flow
Browser -> React feature -> shared API client -> DRF URL -> permission/authentication -> serializer validation -> service/query layer -> PostgreSQL -> response serializer -> UI state.

## 6. Security boundaries
- Authentication identifies the actor; permissions authorize the action.
- Filter querysets by ownership before retrieving private objects.
- Resume files are private by default.
- Do not expose storage keys or permanent public URLs for private resumes.
- Apply upload size/type checks and safe file naming.
- Rate-limit sensitive endpoints such as login and application submission.
- Log security-relevant events without logging secrets or resume contents.

## 7. Deferred infrastructure
S3, Redis, Celery, full-text search services, observability vendors and AI providers are deferred until an accepted requirement and operational justification exist.
