# Stage 2B.4 callback authority and frontend acceptance

Baseline: `feat/admin-workspace-final`, HEAD
`4851a337a841e621320524541bfc0a85652152e1`, committed tree
`abcd6827f2d587c5c1ea6c13b76565e4d154b424`. Existing local operations
notes in PROJECT_STATUS.md and LOCAL_DEVELOPMENT.md are preserved and excluded.

## F-01 reproduction and repair

The baseline binds an Axios permit when a callback calls http, rather than when
its originating view is created. A callback retained across an auth-provider
remount can therefore acquire the replacement provider's permit. Independent
frozen-baseline tests produced 25 expected failures across the five mutation
actions and five session transitions, with 30 other tests passing. Five positive
baseline controls explicitly assert B's Authorization header and A's submitted
payload/file. These use real Axios interceptors and canonical session storage,
with a synthetic adapter: they prove request dispatch, not server persistence.
Evidence: /tmp/devjobs-2b4-independent-red.log and
/tmp/devjobs-2b4-positive-baseline-dispatch.log. Test-only synthetic credentials
are distinct from real credentials and never use an existing database.

`useViewAuthority` captures canonical request ownership once per mounted view in
a layout effect. Its invalidatable lifetime, cancellation signal and existing
`_assertAuthority` callback accompany each request. Retained callbacks validate
before initiating work; response handlers validate the same captured config.
Transport uses the unchanged canonical dispatch and refresh/retry checks. No
callback may capture replacement ownership at invocation time. Cleanup aborts
pending requests; checks also reject noncooperating/late transports. A synchronous
busy flag prevents duplicate dispatch before React updates its loading state.

| View/action | Initiation and transport | Result/side effect |
| --- | --- | --- |
| Candidate/recruiter save | Captured view and session, PATCH config | Form, snapshot, message and errors require live origin |
| Profile discard/retry | Live view/session; discard also rejects busy view | No retired form reset or stale fetch |
| Resume upload/replace/remove | Captured ownership, PUT/DELETE config | Metadata/errors require live origin |
| Resume download/retry | Captured GET config; download revalidates before creating link | No retired download link |
| Application submit | Captured ownership, POST config; job-specific editor lifetime | Navigation/errors require live origin |

82 deterministic real-Axios regressions cover A/B, A/B/A, same-account new epoch,
logout/login, provider remount, page-only remount with provider still alive,
retained removal/discard confirmation, queued interceptor and canonical shared
lock dispatch, late 200/400/401, valid refresh/retry and retirement during refresh.
They assert actual sends, original credentials/payloads, no replacement dispatch,
no stale UI state, unchanged replacement identity, opaque permit continuity and
Strict Mode usability. Existing session-store, cross-tab, skills and membership
regressions remain mandatory. Role/object authorization remains server-owned.
Already-dispatched server effects cannot be recalled by frontend cancellation.

## F-02 evidence and acceptance recovery

The completion audit log `/tmp/devjobs-completion-audit-frontend.log` records
213 passes and one failure at `Remove python`. Its focused diagnostic passed.
Three fresh exact-baseline full-suite runs each passed 214 tests / 22 files
(`/tmp/devjobs-2b4-independent-baseline-{0,1,2}.log`). Thus the original full-suite
failure is intermittent; no exact historical React schedule can be reconstructed
from its truncated DOM diagnostic. A production skills defect is not established.

The old assertion starts waiting for the final removal control immediately after
clicking Add skill: asynchronous Ant Design validation, POST completion, GET
refresh and React rendering all share one default query deadline. It does not
observe whether submission occurred or whether the mutation is still pending.
The recovered integration test holds the POST with a controlled promise, asserts
the actual payload/config, proves no removal control exists while pending, then
releases success, observes the list refresh and queries the rendered control.
It independently waits for profile-save completion, resets mock implementations,
and runs in ordinary and Strict Mode. This removes the ambiguous scheduling
assumption without sleeps, increased timeouts or weakened assertions. Each GET
has effect-scoped invalidation, including Strict Mode replay. Vitest's per-file
isolation and separate module mocks provide no demonstrated cross-file shared
mock leak. Remove python remains its exact accessible name; decorative loading
icons do not rename the explicit skill removal label.

A later full run passed all 297 assertions but exited unsuccessfully with an
unhandled React scheduler `window is not defined` in AdminPage.test.jsx after
JSDOM disposal (`/tmp/devjobs-2b4-final-full.log`). Static Ant Design message roots
are separate from the test container; profile/admin teardown now awaits cleanup
and message.destroy inside act. This is test lifecycle repair only; moderation
behavior and dashboard production source are unchanged. Failed runs are retained
and cannot serve as accepted gates. Historical F-02 attribution remains bounded:
the controlled pending-mutation test demonstrates the assertion ordering issue,
not the exact renderer timing of the earlier audit failure.

## Verification and exact snapshot contract

Commands from frontend:

- `npm test -- src/features/profiles/ProfilePage.test.jsx src/features/auth/legacyActions.session.test.jsx` (repeat three times).
- `npm test` (complete suite; unhandled errors fail acceptance).
- `npm run lint` and `npm run build`.

Commands from repository root:

- `backend/.venv/bin/ruff check backend`.
- `/tmp/devjobs-m1-schema-tools/bin/python scripts/validate_openapi.py`.
- `backend/.venv/bin/python backend/run_browser.py`.
- `backend/.venv/bin/python backend/run_browser_concurrent.py`.

From backend: `.venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit`.
The browser runners create owned disposable PostgreSQL 17 clusters and execute
the full backend suite, Django checks, migration consistency and Chromium. The
concurrent pair verifies peer service, cluster and credential rejection. Updated
browser workflows exercise 390px keyboard submission for both profile types and
applications, keyboard-native resume file selection/removal, and include 1440/768/390 layouts, keyboard skill removal, membership
controls and candidate profile/resume/application flows. This is bounded workflow
accessibility coverage, not comprehensive WCAG certification.

No Python code changed. Repository-wide `ruff format --check backend` still
reports the 29 baseline files; no unrelated formatting is included. Build's large
chunk advisory and JSDOM pseudo-element/style diagnostics remain baseline issues.
Eight optional Redis tests may skip; production throttling is unchanged.

Stage only the listed implementation/tests, this document and the new status
entry. Run `git diff --cached --check`, write-tree, git archive into an isolated
export, fresh npm ci, repeated focused tests, full frontend/lint/build, Ruff,
OpenAPI, runner safety, standalone and concurrent runners against that export.
Rehash every exported tracked file against its Git object before/after acceptance.
Do not commit a failed tree. Exact results/tree/commit identities belong in the
external delivery manifest; the commit must equal the tested tree. Verify empty
index, preserved operations diffs, and runner-owned cleanup afterward.

No development database or devjobs_test is used. Native Chromium/Web Locks is
the browser boundary. F-03, F-04, M-06, JWT revocation and Stage 2C remain outside
scope. No push, merge, deployment or PR #1 modification is authorized.

Two development invocations used the wrong working directory: root-level
`npm test -- --run src/features/auth/legacyActions.session.test.jsx` failed
ENOENT (254), and `backend/.venv/bin/python -m unittest ...` from backend failed
with interpreter path not found (127). Correct frontend and `.venv/bin/python`
invocations passed. Initial sandbox Docker denial created no resources; the
approved isolated runner passed. These are harness/setup failures, not accepted
gates. Changed JavaScript follows existing formatting and ESLint; `git diff
--check` enforces changed-line whitespace. There are no changed Python files to
format.
