# Staging readiness and release assurance — 2026-11-07

**Verdict: BLOCKED for release.** Python dependency security now passes (see resolution below); infrastructure and PostgreSQL patch-level gates still prevent staging sign-off. This review started on a clean `feat/private-candidate-resumes` at `8e5cf77605887b2b5aea72c30376def8130b924c`. The owner reports all three hosted Actions workflows passed at that commit; hosted results were not independently queried here. Local changes below have no hosted CI result.

## Checklist

PASS means executed locally or verified in source; it never implies a hosted deployment. BLOCKED means a required decision/remediation is outstanding. NOT VERIFIED means the actual environment/evidence was unavailable.

| Gate | Result | Evidence / required next action |
|---|---|---|
| Branch/starting identity | PASS | Exact supplied HEAD; starting working tree/index empty |
| Python advisory audit | PASS | DRF 3.18.3 / pytest 9.0.3; 26 distributions, zero findings; exact pins and artifact hashes |
| PDF dependency remediation | PASS | pypdf 6.12.0 → exact 6.21.4; full backend suite passes |
| Frontend advisory audit | PASS | npm audit: zero findings, including development dependencies |
| OpenAPI semantics/routes | PASS | 3.1 validator plus 39 paths / 55 operations matched to Django; explicit security, IDs, UUID parameters, references and success schemas |
| Backend PostgreSQL 17.5 compatibility | PASS | 134 tests; strict server/port/database identity guard; retained separate test database |
| PostgreSQL release security | BLOCKED | 17.5 is the compatibility baseline, not a current security baseline; review patched PG17 server/client release and reverify separately |
| Frontend regression/lint/build | PASS | 43 tests; lint/build pass; existing 525.90 kB bundle advisory |
| Local real-browser journey | PASS | Chromium harness result recorded below; synthetic data only |
| Production configuration validation | PASS | Required secrets/hosts/DB/cache, HTTPS/origin/storage guards reviewed and covered by tests; synthetic deploy check passes |
| Real secret injection/rotation | NOT VERIFIED | Choose secret manager, access roles, rotation and JWT/session invalidation procedure |
| TLS, proxy, hosts, CORS/CSRF | BLOCKED | No actual topology, domains or origins selected; test header stripping and upstream isolation |
| Persistent PostgreSQL/Redis | BLOCKED | Select service/owners, network/TLS/credentials, capacity and availability; shared cache is already required by implemented login throttle |
| Private resume storage | BLOCKED | Select durable shared private volume or installed private object adapter; no object adapter is bundled |
| Static/admin assets and SPA hosting | BLOCKED | Select serving process; collectstatic dry-run passed; real artifact routing/cache behavior unverified |
| Staging migration/rollback rehearsal | NOT VERIFIED | Needs isolated restored staging DB/private files; local tests are not this rehearsal |
| Backup/restore documentation | PASS | Executable operator procedure in PRODUCTION_DEPLOYMENT.md |
| Backup job, encrypted retention, restore drill | NOT VERIFIED | No backup or restore executed; record checksums, file reconciliation, timings, RPO/RTO |
| Monitoring, alerts, resource limits | BLOCKED | Select operators/destinations and test 5xx/readiness/storage/DB/disk alerts; configure edge upload/header/time limits |
| Staging role/access smoke tests | NOT VERIFIED | Execute plan below against actual HTTPS staging after deployment |

## Python dependency audit — historical starting evidence

Superseded by the Python security resolution below. Prior artifacts are preserved unchanged.

Used **pip-audit 2.10.1**, PyPI JSON vulnerability API backed by the [PyPA advisory database](https://github.com/pypa/advisory-database). Audited all 26 actual installed distributions in `backend/.venv`, including transitive, development and installer packages. No speculative resolver run against loose requirements was substituted for installed versions. Exact post-fix inventory: [resolved versions](security/python-resolved-2026-11-07.txt). Advisory IDs, aliases, fix versions and pre/post counts: [audit evidence](security/python-audit-2026-11-07.json). No packages skipped. Raw output under `/tmp` is ephemeral; the committed-document candidate evidence is summarized in these files.

Initial scanner exit **1**, 70 advisory records across four packages. After targeted fixes: exit **1**, seven records across two packages. These are scanner records, **not 70 or seven distinct CVEs**; the feed contains duplicate IDs and aliases.

| Dependency | Original → verified | Disposition |
|---|---|---|
| pypdf | 6.12.0 → 6.21.4 | Same-major security update pinned in base requirements; removes all 55 raw findings; includes malformed xref/page-tree/dictionary resource-exhaustion fixes relevant to opening untrusted resumes. Existing upload/replacement/denial tests pass. |
| pip | 26.0.1 → 26.3 | Updated only local venv installer; removes eight raw findings. Require patched installer in release build tooling; repository runtime requirements do not manage pip. |
| djangorestframework | 3.16.1 unchanged | Five findings: PYSEC-2026-3827, PYSEC-2026-3828, CVE-2026-114136, CVE-2026-114137, CVE-2026-114138. Fixes require ≥3.18.2 outside current `<3.17`. Evaluate 3.18.3 (also fixes 3.18.2 regression), Django minimum and list-error compatibility before changing the public API. **Release blocker.** |
| pytest | 8.4.2 unchanged | Two records for PYSEC-2026-1845 / CVE-2025-71176; fixed in 9.0.3, outside `<9`. Development-only temp-directory risk; use isolated trusted CI users/runners and plan a focused pytest 9 compatibility update. Not a runtime exposure, still unresolved. |

DRF JSON/form memory-limit bypass and Accept-header/charset denial of service affect an exposed API. Edge body/header/time/concurrency limits reduce exposure but do not resolve the audit. AdminRenderer is not enabled (default BrowsableAPIRenderer is different), and DRF database token authentication/TokenProxy is not used (JWT is used); this reduces applicability of two findings without making the dependency clean. No ignore/suppression was added. The authorized safe PDF fix was applied; cross-constraint compatibility changes were left explicit because repository instructions require owner review before changing public API compatibility. No question is needed to report that blocker.

Source review: [DRF release notes](https://www.django-rest-framework.org/community/release-notes/), [pypdf releases](https://github.com/py-pdf/pypdf/releases/tag/6.21.4), [pytest advisory](https://github.com/advisories/GHSA-6w46-j5rx-g56g). Full dependency locking/hashes and a repeat audit of the actual staging image remain required: requirements ranges can resolve differently from this workstation. Native libpq/OpenSSL, Python, OS images and Redis are outside pip-audit's Python advisory scope.

PostgreSQL 17.5 remains untouched. [PostgreSQL's PG17 security list](https://www.postgresql.org/support/security/17/) lists later fixes, including CVE-2025-8713/8714/8715 fixed in 17.6 and later security releases. Select a currently patched PG17 server **and backup/client binaries**, then approve and test that baseline; do not infer security from successful 17.5 compatibility tests. No PG14/18 connections or service changes were made.

## OpenAPI corrections and limits

Corrected readiness `/ready/` to implemented `/api/v1/ready/`, added omitted liveness, supplied 15 missing IDs and explicit authentication declarations, and quoted flow-style descriptions containing commas (previously parsed as accidental response keys). Added concrete admin/moderation/application/job success schemas and pagination envelopes. PATCH company/job schemas now permit partial updates; job PATCH omits non-writable company changes. Salary output is a decimal string or null, not a JSON number; nullable dates now use JSON Schema null types. Optional blank URL fields reflect serializers. No Django route or response behavior was changed.

`scripts/validate_openapi.py` runs OpenAPI 3.1 semantic validation, checks local references, unique operation IDs, complete required UUID path parameters, explicit public/JWT policy, success schemas, exact implemented API route/method coverage, and six serializer output field sets. Three deliberately broken contracts (stale route, missing JWT, duplicate ID) must be rejected. Django `/admin/`, OPTIONS and implicit HEAD are intentionally outside the REST operation inventory. This is not exhaustive response-instance/property-constraint conformance testing; staging negative authorization and error tests are still required. The script uses isolated tooling, with no new runtime dependency.

## Infrastructure decisions and actionable sequence

1. Python dependency blockers are resolved locally; approve a patched PostgreSQL 17 baseline. Rerun backend, browser and advisory gates; publish these changes only through the existing review process. Keep the prior artifacts.
2. Select hosting/process runner, deployment region, actual domains, same-origin or cross-origin routing, TLS terminator/trusted hop count, secret delivery, private networking, persistent DB/shared Redis/private storage, backup target and operational owners. No provider/URL/credential is assumed. Object storage requires selecting/installing and verifying an adapter; a private shared durable volume is the existing alternative, not ephemeral worker disks.
3. Build immutable backend and frontend artifacts using captured resolved dependencies. Inject real secrets only at runtime; public VITE_API_BASE_URL is a build input. Keep `.env` out of artifacts. Configure file/body/header/time/concurrency budgets and non-root process/file permissions.
4. Prepare isolated staging resources with dedicated secrets and synthetic or approved anonymized data. Test the coordinated backup/restore runbook there, then migration plan/application on the restored copy. Record applied migration graph and schema compatibility with the previous app.
5. For an authorized deployment window, stop writers/drain traffic, capture paired backup, run the reviewed migration once with a distinct migration operator, collect static assets, start bounded workers, and check readiness over actual HTTPS. Runtime DB role must not be superuser/schema owner; test existing trigger-backed invariants with that role. Keep API/admin and private storage outside SPA fallback.
6. Execute the smoke plan, failure/alert drills and rollback rehearsal; record evidence without personal data. Release requires every BLOCKED gate resolved and every environment-specific NOT VERIFIED gate signed off. No deployment was performed here.

## Staging smoke plan (not executed remotely)

Use synthetic candidate A/B, recruiter owner A/company A, recruiter owner B/company B, a same-company MEMBER, and a trusted operational administrator. Create accounts through ordinary registration except the administrator, provisioned through trusted createsuperuser. Keep IDs/tokens out of logs and private evidence under restricted retention.

| Journey | Required checks / expected results |
|---|---|
| Edge and assets | Valid certificate/host, HTTPS redirect without loop, spoofed forwarded scheme/IP ignored/overwritten; upstream inaccessible publicly. Correct security headers; exact allowed origin works, unrelated origin has no CORS grant. Admin CSS/JS loads, frontend deep links work, API 404 returns API response. |
| Probes and dependencies | Health 200; ready 200/no-store; controlled isolated DB/cache/storage outage yields ready 503 with generic body while health stays 200. Recovery restores ready; alert reaches selected operator. Never interrupt production services. |
| Candidate | Register/login/refresh, protected route guards, profile update, skill add/remove; public search/filter/pagination; upload valid PDF, metadata contains no storage keys/URLs, own attachment download headers, replace and delete; invalid/encrypted/oversized PDF rejected. Apply once, duplicate rejected, track status, own-only detail and withdrawal. Candidate B cannot read A's application/resume. |
| Recruiter | Profile/company create/edit, membership role controls; draft absent publicly; create/edit/publish/close, pages and status filters. OWNER/ADMIN can inspect applicants/update allowed statuses/download current resume; MEMBER, unrelated recruiter, candidate and anonymous denied. Cross-job application IDs cannot bypass access. Withdrawal, candidate suspension and removed/suspended membership revoke new downloads. |
| Administrator | Ordinary candidate/recruiter JWT cannot access admin APIs; forged registration/profile privilege fields do not grant staff. Trusted admin overview/lists/history load. Hide job, suspend company/recruiter/candidate with required reason, verify immediate enforcement using already-issued JWTs. Hidden/suspended jobs cannot be published/edited/applied to; resume access follows restrictions. Restore/reactivate and verify intended recovery. Audit retains actor/reason/old/new states; update/delete prohibited; admin has no blanket resume download. |
| Migration safety | Verify isolated target DB/server first; save showmigrations/migrate --plan. Restore prior-release DB/private files to empty isolated target; run new migrations once, then again (no changes), run checks/integrity/auth tests, compare approved count-only invariants and file references. Exercise preflight failure only with synthetic invalid fixtures in disposable DB and confirm no partial data changes. Never use --fake, reset, or reverse immutable-audit triggers casually. |
| Recovery | Verify paired backup checksums, restore both to isolated empty target, test retained applications, constraints/audit triggers, resume bytes/access and orphan dry-run. Record elapsed recovery/RPO/RTO, key availability, missing/orphan counts. Rehearse previous-app rollback only with proven schema compatibility; otherwise forward-fix or coordinated restore during maintenance. |

Expected denials may be 401/403/404 according to endpoint; compare documented behavior and ensure no sensitive body/file leaks. Verify close/reject behavior separately from moderation: closed jobs and rejected applications may retain authorized resume access; withdrawal revokes it. A previously opened stream may finish. Record each case PASS/FAIL with release/artifact identity and timestamp before signing off.

## Exact verification commands and outcomes

Commands run from repository root unless a directory is specified. Temporary tooling was installed in `/tmp/devjobs-release-tools`; first sandbox install/npm advisory requests failed DNS and were rerun with network permission. No repo dependency was added for audit tooling.

```sh
python3 -m venv /tmp/devjobs-release-tools
/tmp/devjobs-release-tools/bin/pip install pip-audit openapi-spec-validator
backend/.venv/bin/python -m pip list --format=json > /tmp/devjobs-python-resolved.json
# Converted that JSON to exact name==version lines in /tmp/devjobs-python-resolved.txt.
/tmp/devjobs-release-tools/bin/pip-audit -r /tmp/devjobs-python-resolved.txt --no-deps --disable-pip --progress-spinner off --cache-dir /tmp/devjobs-pip-audit-cache -f json -o /tmp/devjobs-python-audit.json
backend/.venv/bin/pip install pypdf==6.21.4 pip==26.3
backend/.venv/bin/python -m pip list --format=json > /tmp/devjobs-python-resolved-after.json
# Converted post-fix JSON to /tmp/devjobs-python-resolved-after.txt.
/tmp/devjobs-release-tools/bin/pip-audit -r /tmp/devjobs-python-resolved-after.txt --no-deps --disable-pip --progress-spinner off --cache-dir /tmp/devjobs-pip-audit-cache -f json -o /tmp/devjobs-python-audit-after.json
backend/.venv/bin/python -m pip check
/tmp/devjobs-release-tools/bin/python scripts/validate_openapi.py
backend/.venv/bin/ruff check backend scripts/validate_openapi.py
backend/.venv/bin/ruff format --check scripts/validate_openapi.py
```

Audit outcomes above; pip check **PASS**, semantic script **PASS** (39 paths/55 operations and negative controls), Ruff lint/changed-script format **PASS**. Initial semantic validation and script lint exposed issues which were corrected before final verification. Historical whole-repo formatting differences were not reformatted.

Backend commands in `backend/` use a generated process-only key and read the existing DB URL without printing it:

```sh
env -u DATABASE_URL DJANGO_SECRET_KEY="$(.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')" DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')" .venv/bin/python -m pytest --tb=short -q
# Same environment prefix, replacing pytest with:
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
CI=true env -u DATABASE_URL DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')" .venv/bin/python run_browser.py
```

Pytest **PASS 134**, 35.67s before dependency fixes; **PASS 134**, 33.06s after fixes, strict PostgreSQL 17.5, retained `test_devjobs_test`. Django check **PASS**, no issues; migration consistency **PASS**, no changes. Browser harness operates only on guarded `devjobs_test`, reported no pending migrations; synthetic records may remain and temporary admin is disabled at exit. No reset was run.

Production check was run as `.venv/bin/python /tmp/devjobs-production-check.py`: Python subprocess injected `DJANGO_SETTINGS_MODULE=config.settings.prod`, generated 64-byte-url-safe secret, `DJANGO_DEBUG=false`, synthetic `.invalid` DB/cache endpoints, `api.example.test` host, empty CORS/CSRF origins, temporary private root, HTTPS redirect on, proxy trust off and one-year HSTS/include-subdomains/preload. Invoked `.venv/bin/python manage.py check --deploy --fail-level WARNING` (**PASS no issues**) and `.venv/bin/python manage.py collectstatic --noinput --dry-run --verbosity 0` (**PASS**). No dependency connections or static writes; synthetic HSTS is a fixture, not a selected domain policy. Actual production settings/services remain NOT VERIFIED.

Frontend commands in `frontend/`:

```sh
npm test > /tmp/devjobs-staging-frontend-tests.log 2>&1
npm run lint
npm run build -- --outDir /tmp/devjobs-staging-build --emptyOutDir false
npm audit --json > /tmp/devjobs-staging-npm-audit.json
```

All **PASS**: 43 tests/11 files, lint, build and audit (zero findings). Existing non-failing JSDOM pseudo-element diagnostics and 525.90 kB minified chunk advisory remain. Browser outcome and final Git checks follow in the final verification entry below.

Final verification: guarded Chromium harness **PASS 1 scenario, 22.8s**, after dependency remediation; `No migrations to apply`. `git diff --check` **PASS**. Branch/HEAD unchanged; index empty. Final paths (all unstaged):

```text
 M PROJECT_STATUS.md
 M backend/requirements/base.txt
 M docs/LOCAL_DEVELOPMENT.md
 M docs/PRODUCTION_DEPLOYMENT.md
 M docs/RELEASE_REVIEW.md
 M docs/openapi.yaml
?? docs/STAGING_READINESS.md
?? docs/security/python-audit-2026-11-07.json
?? docs/security/python-resolved-2026-11-07.txt
?? scripts/validate_openapi.py
```

For reproducing validator tooling, the verified versions were `openapi-spec-validator==0.9.0` and `PyYAML==6.0.3`; audit tooling was `pip-audit==2.10.1`. They are isolated verification tools, not application runtime requirements. The final working tree intentionally contains the requested reviewable fixes/docs; the initially clean tree had no user changes to overwrite. No files were staged or committed.

## Python dependency security resolution — 2026-11-07

**Release-security verdict: PASS WITH BLOCKERS.** The Python dependency gate is PASS;
production release remains blocked by the existing PostgreSQL patch-level and
infrastructure/operational gates above. This entry supersedes earlier statements that
DRF/pytest remain vulnerable. No hosted CI result is available for these local changes.

### Versions and compatibility

| Package / scope | Before | After | Decision |
|---|---|---|---|
| DRF / runtime | 3.16.1, constrained `<3.17` | 3.18.3 | Removes vulnerable cap; requires Django >=5.2; 3.18.3 also reverts 3.18.2 ordering regression |
| pytest / development | 8.4.2, constrained `<9` | 9.0.3 | Minimum advisory-fixed release; no fixture/config adaptation needed |
| Django / runtime | 5.2.19 | 5.2.19 | Pin existing compatible LTS; removes obsolete allowance for Django 5.1 |
| SimpleJWT / runtime | 5.5.1 | 5.5.1 | Compatible with Django/DRF pins; PyJWT remains 2.15.1 |
| pypdf / runtime | 6.21.4 | 6.21.4 | Preserve earlier security remediation |
| psycopg + psycopg-binary / runtime | 3.3.8 | 3.3.8 | Matched exact versions; PostgreSQL 17.5 regression passed |
| Redis client / runtime | 6.4.0 | 6.4.0 | Existing shared login-throttle cache client; server version/security not covered |
| pytest-django / development | 4.14.0 | 4.14.0 | Existing version works with pytest 9 |
| coverage / development | 7.17.2 | 7.17.2 | Preserve existing version |
| Ruff / development | 0.17.3 | 0.17.3 | Preserve existing version |
| pip / installer | 26.3 | 26.3 | Bootstrap separately; not an application dependency |

All other installed versions remain unchanged. Complete exact inventory:
[secure inventory](security/python-resolved-secure-2026-11-07.txt); dependency edges
and Python metadata: [dependency tree](security/python-dependency-tree-2026-11-07.json).
No Celery, kombu, billiard or asynchronous queue dependencies are installed or added.
DRF's list-serializer validation error default changed upstream; application `many=True`
serializers are output-only, and no bulk list input endpoint is present. Existing input
errors, JWT, moderation, object access and private resume behavior pass regression tests.
No application code, settings, API contracts, schema or migrations changed in this task.
The upstream references are [DRF release notes](https://www.django-rest-framework.org/community/release-notes/)
and [pytest changelog](https://docs.pytest.org/en/stable/changelog.html).

### Exact advisory accounting

Starting evidence is retained unchanged. Seven raw records contain **six unique IDs**
and six alias-deduplicated advisory groups; `PYSEC-2026-1845` occurred twice (CVE is
an alias, not a seventh unique scanner ID).

| Affected installed version | Advisory ID | Aliases | Fixed boundary | Verified |
|---|---|---|---|---|
| DRF 3.16.1 | PYSEC-2026-3827 | CVE-2026-73228, GHSA-2m8g-3cmr-wg3w | 3.17.2 | 3.18.3 |
| DRF 3.16.1 | PYSEC-2026-3828 | CVE-2026-73229, GHSA-g47c-3xmw-q6m2 | 3.17.2 | 3.18.3 |
| DRF 3.16.1 | CVE-2026-114138 | GHSA-33wh-fxxf-88vv | 3.18.2 | 3.18.3 |
| DRF 3.16.1 | CVE-2026-114136 | GHSA-3547-9m27-7rxg | 3.18.2 | 3.18.3 |
| DRF 3.16.1 | CVE-2026-114137 | GHSA-xw6w-gcfp-cf8m | 3.18.2 | 3.18.3 |
| pytest 8.4.2 | PYSEC-2026-1845 | CVE-2025-71176, GHSA-6w46-j5rx-g56g | 9.0.3 | 9.0.3 |

pip-audit **2.10.1**, PyPI/PyPA feed, all **26** installed distributions including
runtime, test, transitive and installer packages: exit **0**, **zero raw records,
zero unique advisories, zero skipped packages**. No suppressions. Production DRF
and development-only pytest risks are both resolved in this dependency set.
[Raw audit](security/python-audit-secure-2026-11-07.json) and
[count summary](security/python-security-resolution-2026-11-07.json) are retained
alongside the historical artifacts. No-known-findings is bounded by the feed/date;
Python/OS/native libpq/OpenSSL and PostgreSQL/Redis server security are separate gates.

### Reproducibility and commands

`backend/requirements/base.txt` and `dev.txt` now pin the complete runtime and test
closures with PyPI SHA-256 artifact hashes. Existing install commands consume these
pins; presence of hashes automatically enables pip hash checking. All published
non-yanked artifacts for the selected versions are permitted, allowing platform wheels.
Future upgrades must deliberately refresh the exact pins/hashes and rerun the audit.
Use the configured trusted PyPI source and a patched installer (`pip==26.3` verified).
No audit/validator tool was added to production dependencies.

```sh
# Fresh verification environment, from repository root:
backend/.venv/bin/python -m venv /tmp/devjobs-python-security-clean
/tmp/devjobs-python-security-clean/bin/pip install -r backend/requirements/dev.txt
/tmp/devjobs-python-security-clean/bin/pip install --require-hashes --force-reinstall -r backend/requirements/dev.txt
/tmp/devjobs-python-security-clean/bin/pip install pip==26.3
/tmp/devjobs-python-security-clean/bin/pip check
backend/.venv/bin/pip check
backend/.venv/bin/pip inspect > /tmp/devjobs-python-secure-tree.json
backend/.venv/bin/pip install --dry-run --ignore-installed --only-binary=:all: --python-version 3.12 --require-hashes -r backend/requirements/dev.txt
backend/.venv/bin/pip install --dry-run --ignore-installed --only-binary=:all: --python-version 3.13 --require-hashes -r backend/requirements/dev.txt
/tmp/devjobs-release-tools/bin/pip-audit -r docs/security/python-resolved-secure-2026-11-07.txt --no-deps --disable-pip --progress-spinner off --cache-dir /tmp/devjobs-pip-audit-cache -f json -o docs/security/python-audit-secure-2026-11-07.json
backend/.venv/bin/ruff check backend scripts/validate_openapi.py
/tmp/devjobs-release-tools/bin/python scripts/validate_openapi.py
```

All commands above PASS. Python **3.14.4** fresh install reproduces all 25 application/
test packages, with pip separately pinned as the 26th audited distribution. Python
3.12/3.13 wheel/metadata resolution PASS; those interpreters were not executed.
Documented Python minimum remains 3.12; CI uses 3.14. No new dependencies introduced.
An initial hash verification command also supplied an unhashed `pip==26.3` argument
and correctly failed closed; corrected command above passed. Temporary tooling/logs
are under `/tmp`; no credentials are included in repository artifacts.

### Regression results

Backend commands use the exact generated-key/ignored-DB environment prefix documented
in the earlier verification section. No environment file was modified or printed.

| Exact command (directory) | Outcome |
|---|---|
| `.venv/bin/python -m pytest --tb=short -q` (`backend/`) | PASS: 134 tests + 59 subtests, 33.32s; PostgreSQL 17.5, guarded retained `test_devjobs_test` |
| `.venv/bin/python manage.py check` (`backend/`) | PASS: no issues |
| `.venv/bin/python manage.py makemigrations --check --dry-run` (`backend/`) | PASS: no changes detected |
| `backend/.venv/bin/ruff check backend scripts/validate_openapi.py` | PASS |
| `/tmp/devjobs-release-tools/bin/python scripts/validate_openapi.py` | PASS: 39 paths, 55 operations, six serializer field sets, three negative controls |
| `npm test > /tmp/devjobs-python-security-frontend-tests.log 2>&1` (`frontend/`) | PASS: 43 tests / 11 files, 6.23s |
| `npm run lint` (`frontend/`) | PASS |
| `npm run build -- --outDir /tmp/devjobs-python-security-build --emptyOutDir false` (`frontend/`) | PASS; existing 525.90 kB chunk advisory |
| `CI=true env -u DATABASE_URL DATABASE_URL="$(.venv/bin/python -c 'from dotenv import dotenv_values; print(dotenv_values("../.env")["DATABASE_URL"])')" .venv/bin/python run_browser.py` (`backend/`) | PASS: 1 Chromium scenario, 23.1s; no migrations pending |
| `npm audit --json > /tmp/devjobs-python-security-npm-audit.json` (`frontend/`) | PASS: zero findings including development tooling |
| `git diff --check` | PASS |

Existing non-failing JSDOM diagnostics remain. The browser harness uses synthetic
records and disables its temporary admin on exit; synthetic records can remain.
No database reset, PG14/18 access, production infrastructure change, deployment,
staging, commit, push, approval, merge, main edit or PR #1 action occurred.
All original modified and untracked files remain. Branch stays
`feat/private-candidate-resumes`, index empty. Changes in this task are limited to
requirements and security/documentation evidence; earlier staging-readiness edits
are preserved. Release infrastructure, patched PostgreSQL selection and actual
staging backup/restore/smoke evidence remain unresolved as documented above.

Final working-tree verification: **7 modified tracked files, 8 untracked files,
zero staged/deleted** (`git status --short --untracked-files=all`); branch unchanged.
`git diff --check` PASS. Clean-environment inventory comparison asserts all **26**
distribution versions exactly match the audited backend environment: PASS.
