# Versioning and Git workflow

## Product versioning
Use Semantic Versioning: `MAJOR.MINOR.PATCH`.
- `0.x.y`: pre-1.0 development; APIs may evolve, but changes must be documented.
- `1.0.0`: first stable MVP release.
- Patch: backward-compatible fixes.
- Minor: backward-compatible functionality.
- Major: breaking changes.

Use annotated Git tags such as `v0.1.0` and release notes for each published release.

## Branch strategy
- `main`: protected, releasable branch.
- `feat/<short-name>`: feature work.
- `fix/<short-name>`: bug fixes.
- `docs/<short-name>`: documentation-only changes.
- `chore/<short-name>`: tooling and maintenance.

Use pull requests for merging. Require CI and review before merge when repository settings allow.

## Conventional Commits
Format: `<type>(<scope>): <summary>`
Examples:
- `feat(auth): add candidate registration`
- `fix(jobs): prevent applications to closed jobs`
- `test(applications): cover duplicate submission`
- `docs(api): document job search filters`
- `chore(ci): add backend test workflow`

Allowed common types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.

Breaking changes must include `BREAKING CHANGE:` in the commit footer.

## Commit hygiene
- Keep commits small and focused.
- Do not commit secrets, local databases, build output or uploaded resumes.
- Do not combine unrelated formatting with functional changes.
- Never force-push shared branches.
- Review staged changes before committing.

## Release checklist
- Acceptance criteria complete.
- Tests, lint and production build pass.
- Migrations reviewed and applied in a staging-like environment.
- Security and authorization checks pass.
- Environment variables and deployment notes updated.
- Changelog/release notes written.
- Tag only after release approval.
