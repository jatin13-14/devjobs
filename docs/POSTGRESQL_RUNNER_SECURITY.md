# Patched disposable PostgreSQL 17 baseline

The owned test runner uses the official PostgreSQL 17.12 Bookworm image, pinned
to multi-platform manifest digest
`sha256:40865bc877a289da75963d97d72b59633f639fc5af7a4e856bfa3714cae5b536`.
Manifest inspection confirms native linux/amd64 and linux/arm64 entries. This is
a focused PostgreSQL 17 patch update, not a major-version/dependency-stack change.
No existing database, volume, credential, production setting or schema is changed.

PostgreSQL released 17.12 on 2026-11-12 with security fixes. See the official
[release notes](https://www.postgresql.org/docs/17/release-17-12.html).
Persistent upgrades require review of cumulative migration notes, affected indexes,
extensions and backup integrity; disposable fresh clusters have no old indexes or
backups to repair. A real deployment still requires its separately approved
operational upgrade and restore checks.

Before migrations or fixture writes, E2E SQL identity validation now requires
server_version_num >= 170012 and < 180000, as well as the unchanged owned cluster,
database, port, run and credential checks. Pure regressions reject 17.0/17.5/17.11,
PostgreSQL 16/18 and wrong identities; 17.12 and later PostgreSQL 17 patches pass.
Digest pinning prevents a mutable image tag from silently changing the runner.
The strict legacy development-test identity policy remains unchanged and is not
used by any owned-runner acceptance command.

The exact export must pass full frontend tests/lint/build, Ruff/changed-Python
formatting, OpenAPI, 17 runner-safety tests, owned backend-only verification,
standalone and concurrent PostgreSQL 17.12/Chromium with peer rejection, security,
mobile/keyboard workflows and cleanup. Acceptance verifies image architecture and
actual server version; all results and tree/commit identities remain external.
No claim of production upgrade, image-wide vulnerability scan or release approval.
