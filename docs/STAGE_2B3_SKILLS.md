# Stage 2B.3 candidate skills contract audit — 2026-11-15

Verdict: FAIL / blocked before dependent frontend implementation. Baseline verified:
branch `feat/admin-workspace-final`, HEAD
`269dc29e976f1446617d2690b6c35d3f640663cc`, committed tree
`5787fa418ca7afe4d49e7a7c10c1e9ab59b3d3cb`. Initial index empty; no untracked
files. Existing PROJECT_STATUS and LOCAL_DEVELOPMENT operations notes preserved.

## Verified contract matrix

All routes below require JWT authentication and role `candidate`: anonymous 401,
recruiter/admin 403. Profile ownership is resolved solely from `request.user`;
missing profile is 404. There is no arbitrary candidate-ID skills route.

| Method / URL | Request | Success / semantics | Validation / errors |
| --- | --- | --- | --- |
| GET `/api/v1/candidates/me/skills/` | No body; optional `pagination=page`, `page`, `page_size` | 200 array of `{id: UUID, name: string}` by default; opt-in envelope below; own associations only, ordered by globally unique name | Unsupported/empty pagination mode 400; invalid/out-of-range page 404 |
| POST `/api/v1/candidates/me/skills/` | Exactly `{name: string}` | `{id, name}`; 201 new own association, 200 existing own association; reuses canonical global Skill by name or creates it, inside a transaction | Required nonblank name; raw maximum 80 characters; unknown fields, null and NUL characters rejected with 400 field errors; normalized-length defect below returns 500 |
| DELETE `/api/v1/candidates/me/skills/{skill_id}/` | No body; UUID is Skill ID, not association ID | 204 empty response; deletes only caller's association, retains global Skill and other candidates' associations | Missing/foreign association or malformed/nonexistent UUID 404; repeat deletion 404 |
| GET/PATCH `/api/v1/candidates/me/profile/` | Existing profile serializer fields only | Profile fields and timestamps; does **not** contain skills | Unknown/protected fields rejected; skills must be read separately |

The opt-in envelope is `{count, next, previous, results}`. Page size defaults to
20, positive sizes cap at 100; invalid/nonpositive sizes fall back to 20.
`page=last` is supported. Without `pagination`, page/page_size are ignored and the
legacy array is unbounded. Empty first page is a zero-count envelope. Deleting the
last item on the last page can make that page return 404; the future UI must
request a valid prior page. Offset pages are deterministic for a fixed collection,
but concurrent mutations can shift their boundaries. All pages can be requested
explicitly; no snapshot cursor or all-pages consistency guarantee exists.

Normalization is Python `" ".join(value.split()).lower()`: leading/trailing
whitespace removed, runs of Python Unicode whitespace replaced by one ASCII
space, Unicode lowercasing (not casefolding). Punctuation and ordinary non-ASCII
letters are allowed; there is no general skill-character allowlist. DRF rejects
NUL/surrogate characters. Canonical case/whitespace variants reuse a skill;
casefold-equivalent names need not be equal. No candidate skill-count limit is
implemented. The database enforces unique Skill.name, maximum 80, canonical
lowercase/single-space/nonempty naming and unique (candidate, skill) associations.

Unsupported capabilities: update/rename (no PUT/PATCH skill action), adding by
skill ID, global catalog discovery/search, autocomplete, proficiency,
endorsements and atomic replacement. The global Skill table does not imply a
public catalog endpoint. Future UI scope is bounded listing, add-by-name and
confirmed removal using the existing authenticated infrastructure. Both existing
profile/skills screens should share this implementation; no independent caches or
automatic all-page fetch is needed. Existing UI remains unchanged by this audit.

## Blocking validation defect

`SkillInputSerializer.name` checks max_length=80 **before** `validate_name`
normalizes. U+0130 (`İ`) lowercases to U+0069 plus U+0307. A raw 80-character
name passes serializer validation but becomes 160 code points. `Skill.save()`
calls `full_clean()`, which raises Django ValidationError. CandidateSkillsView
catches only IntegrityError, and DRF does not translate this Django exception:
actual API response is HTTP 500 instead of a field-level 400. The transaction
rolls back; this is an input-validation defect, not demonstrated ownership bypass.

Deterministic regression:
`CandidateSkillsContractTests.test_unicode_lowercase_expansion_returns_validation_error`
in `backend/apps/candidates/skills_contract_tests.py`. It disables the test client's
exception reraising to assert the actual 500 against expected 400. The test is
intentionally failing, not skipped/xfail. Successful repair must also reach its
no-Skill/no-association assertions. Other tests verify Unicode/punctuation
normalization, duplicate reuse, field validation, cross-account privacy, every
method's role denial, and last-page deletion/fallback.

Smallest proposed repair requiring owner authorization: retain normalization and
the raw 80-character cap, additionally validate the canonical name's length in the
serializer and return a DRF `name` field error when it exceeds 80. No schema,
migration, normalization-policy or ownership change is proposed. Frontend-only
rejection would leave direct API requests vulnerable and cannot substitute for
server validation. The milestone prohibits unauthorized backend-contract changes,
so no production repair or dependent UI implementation was made.

## Verification and limits

`backend/.venv/bin/python /tmp/devjobs-2b3-contract-audit.py` derives from the
existing owned-resource runner, narrows pytest to candidate contract/API and
collection-pagination tests, and exits before browser provisioning. Final run:
**18 passed, 1 failed, 0 skipped (19 collected, 3.32s)** on owned disposable
PostgreSQL 17; migrations applied, Django check 0 issues, migration consistency
PASS. Run `39f26fbf6b31465f965e09fb88585dc5`, container `71b2afd9265d`, cluster
`7708316405988331565`. Cleanup reported. Log:
`/tmp/devjobs-2b3-contract-audit.log`.

Initial sandbox Docker access was denied before resources were created; approved
host execution proceeded. First host run: 17 passed / 2 failed, including a test
fixture incorrectly creating ADMIN through create_user. That fixture now uses
create_superuser with an unusable password. Initial evidence retained at
`/tmp/devjobs-2b3-contract-audit-initial.log`; its owned resources also cleaned.
The final remaining failure is the reproduced production validation defect.

Changed-test Ruff lint/format and `git diff --check` PASS. Full frontend/backend,
Chromium standalone/concurrent, peer isolation, accessibility, OpenAPI, runner
safety and exact staged-export acceptance gates were not run. No staged/tested
tree, commit or committed change tree exists for this task. No application, API,
schema, dependency or production-settings change. No development database used.
No push, merge, deployment or PR #1 modification. M-06 remains open; no production
readiness claim and no Stage 2C work. Resume only after authorization for the
backend validation repair, then implement Stage 2B.3 and run every required gate.

## Authorized continuation — 2026-11-15

The historical blocked verdict above is superseded by the explicitly authorized
repair and continuation. The original failing API regression is retained.
Serializer validation applies the identical whitespace/lowercase expression used
by Skill.save, then checks the actual model field maximum. No existing canonical
helper exists to reuse. Raw CharField validation remains unchanged. The API's
only skill creation path is CandidateSkillsView.post; profile PATCH rejects skills,
DELETE only removes the caller association, and no catalog/edit route exists.
Django admin/model bulk writes are not candidate API paths and are unchanged.
No schema, migration, dependency, authentication or production-settings change.

The shared CandidateSkills component is used by both candidate profile and skills
screens. It requests 20-item pages, adds by name, confirms association removal,
reloads after mutations and steps back if a former last page becomes invalid.
Loading/empty/error states and field-level errors are shown. Buttons are labelled,
keyboard-operable and mutation submissions are guarded synchronously. Long names
wrap; pagination disables while mutating. Rename/edit, catalog search,
autocomplete, add-by-ID and proficiency remain unsupported.

Each rendered page/reload owns an invalidatable lifetime. Requests capture the
canonical Axios session ownership and assert view authority at dispatch/retry and
response. Cleanup aborts requests and invalidates retained actions. Provider epoch
remounts handle account changes, same-user replacement and logout; shared storage
permit checks protect the interval before cross-tab events arrive. Backend role
and ownership checks remain authoritative. A dispatched request can finish for
its original user after logout; cancellation does not promise server rollback.

Reproduction: 18 passed / 1 failed, HTTP 500, owned PG17 cleanup confirmed.
Repair: focused API/profile/pagination 20 passed; initial full backend 185 passed /
8 optional Redis skipped. Ruff, changed-method/test formatting, Django checks,
migration consistency, OpenAPI (39 paths / 55 operations / 3 negative controls),
16 pure safety tests passed. Exact full frontend/Chromium/concurrent/export
results and tree/commit identities are delivered outside this frozen document.
See TESTING_STRATEGY.md for commands, test coverage and development failures.

Final acceptance is conditional on every required frozen-export gate passing.
Unrelated operations notes remain unstaged. M-06 remains open; hosted CI,
production readiness and race freedom are not claimed. No push, merge, deployment,
PR #1 modification or Stage 2C work is authorized or performed.
