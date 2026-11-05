# Instructions for AI coding agents

These instructions apply to the entire repository. Read `PROJECT_STATUS.md` and the relevant docs before editing.

## Product guardrails
- Product: DevJobs, a global job marketplace for software developers.
- Initial audience: software developers, including IT, AI and full-stack roles.
- Initial business model: free; monetization is explicitly out of MVP scope.
- Build the P0 MVP in `docs/PRODUCT_REQUIREMENTS.md`. Do not silently add scope.

## Stack guardrails
- Frontend: React + Vite, JavaScript. Do not introduce Next.js or TypeScript unless the owner approves.
- UI: Ant Design components plus project-owned design tokens and reusable wrappers.
- Backend: Django + Django REST Framework.
- Database: PostgreSQL.
- Auth: JWT and explicit role-based permissions.
- Architecture: modular monolith.
- Defer S3, Celery, Redis, search infrastructure and AI until a documented requirement justifies them.

## Implementation rules
1. Inspect the existing code and Git status before changing anything.
2. Do not overwrite, delete, or reformat unrelated user work.
3. Follow existing naming, linting, formatting and folder conventions.
4. Keep business logic out of React presentation components and Django views where practical.
5. Reuse existing components and API utilities; avoid duplicate abstractions.
6. Use atomic composition: atoms -> molecules -> organisms -> templates -> pages. Do not create wrappers for trivial one-off elements.
7. Keep components accessible, responsive and keyboard-operable.
8. Validate all input server-side. Never rely on frontend authorization.
9. Enforce object-level access: candidates see their own applications; recruiters see applicants for jobs owned by their company.
10. Use migrations for schema changes. Never edit production data manually.
11. Add or update tests for changed behavior.
12. Run relevant tests, lint, type/build checks available in the repo. Report exact commands and outcomes; never claim a check passed if it was not run.
13. Update docs and `PROJECT_STATUS.md` when behavior, API, schema, decisions or task state changes.
14. Keep secrets, tokens, credentials and real personal data out of source control and logs.
15. Do not introduce dependencies without explaining why and checking whether an existing dependency already solves the need.

## Git rules
- Never force-push, rewrite shared history, or commit directly to a protected main branch.
- Use a focused branch per feature or fix.
- Use Conventional Commits; see `docs/VERSIONING_AND_GIT.md`.
- Do not create a release tag until release checks pass.
- Do not stage or commit unrelated files.
- Ask before destructive Git operations or broad dependency upgrades.

## Delivery format
For each task, report:
- What changed
- Important files
- API/schema impact
- Tests and commands run, with pass/fail status
- Known limitations or follow-up work
- Documentation updated

## Stop and ask
Ask the owner before changing product scope, core stack, authentication model, data ownership, public API compatibility, deployment architecture, or any destructive operation.
