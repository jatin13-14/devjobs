# M-06 compatible pagination and API scalability

## Audit and implementation plan

Verified baseline: `feat/admin-workspace-final`, commit
`0f192e1f5d1e30e53119c7a7592ebf290f282e1c`, tree
`a2840bd8a6175e47e6ed62874a9268a2c9eee628`. PR #2 is open,
`fix/stage-2b5-security` → `review/stage-2b5-baseline`. M-06 branches from
that exact head and targets `fix/stage-2b5-security` as a dependent draft PR.
The pre-existing operations changes in PROJECT_STATUS.md and
LOCAL_DEVELOPMENT.md are excluded from this change.

| API collection (prefix /api/v1) | Existing contract / frontend consumer |
|---|---|
| candidates/me/skills/ | Legacy array; opt-in page envelope. Dashboard presence preview; skills/profile numbered pages |
| recruiters/me/companies/ | Legacy array; opt-in page envelope. Company directory/picker and exact-ID membership discovery |
| companies/{id}/members/ | Legacy array; opt-in page envelope. Company management numbered pages |
| jobs/, companies/{id}/jobs/ | Always page envelope. Public search, company jobs, recruiter published total; protected job lookup formerly traversed every preceding page |
| candidates/me/applications/, jobs/{id}/applications/ | Always page envelope. Dashboard preview, candidate tracking, recruiter applicants |
| admin/{companies,jobs,candidates,recruiters,history}/ | Always page envelope. Moderation numbered tables/history |

GET collections were traced through config/urls.py, collection_response,
ListAPIView subclasses, moderation APIViews, frontend http.get/jobsApi call sites,
OpenAPI and the preceding Stage 2C/M-07 findings. Embedded application skills,
job skills and detail history are existing nested representations, not standalone
collection endpoints; their contracts remain intact. Legacy arrays are the three
rows identified above. Active frontend consumers already request bounded pages.
All page-number modes perform exact counts and support deep offsets. Public
search and numbered tables display counts; M-07 uses a one-row published page for
its total and a bounded company-wide SQL application aggregate. Those counts are
intentional behavior, not discarded preview work.

Plan before implementation: retain all defaults, add a shared explicit count-free
keyset mode, migrate the dashboard's existence/three-row previews, replace
protected job traversal with exact scoped filtering, measure SQL plans before
adding an index, and run the existing exact-export acceptance process. Do not
retire public contracts without an approved policy.

## Implemented contract

`pagination=cursor` is additive on all collections in the table. Its response is
`{next, previous: null, results}` with no count. First request omits cursor;
continuations use the signed token from next. Reads materialize at most
page_size + 1 parent records, default 20, maximum 100; invalid/nonpositive sizes
retain DRF's default-20 behavior. There is no SQL COUNT or OFFSET. Page is ignored
in cursor mode. Tokens expire after 24 hours, have a 16,384-character input limit,
and bind caller identity, path, filters/repeated parameters and ordering. Page
size may change. Invalid, expired or transplanted tokens return HTTP 400 after
normal access checks. Tokens are signed, not encrypted, and are not authorization
capabilities. Authorization and visibility are recomputed for every request.

Existing order is retained except jobs in the new cursor mode use immutable
created_at DESC, id DESC, including drafts with null published_at. Legacy job
ordering remains published_at DESC, created_at DESC, id ASC. Uniform-direction
multi-column keys use SQL row comparisons; mixed-direction keys use explicit
lexicographic predicates. Every ordering includes a unique key. This avoids
DRF offset cursor tie limits, including more than 1,000 identical timestamps.

Job lists additionally accept validated job_id UUID within their existing
visibility/filter scope. Protected editor lookup makes one count-free, one-row
company request and rejects missing/foreign jobs; it never follows next URLs.
Dashboard jobs/applications/skill-presence previews use count-free mode. They do
not traverse next links. Existing session capture, view retirement, deadlines,
JWT policy, permissions and object ownership remain in force. No automatic retry
of mutations, new service, dependency or production settings change.

## Query evidence and schema

Owned PostgreSQL 17.12, 1,200 synthetic jobs with identical created_at values:
the initial offset plan sorted 1,200 rows and emitted 1,120 into LIMIT; the initial
OR-keyset plan scanned all 1,200 rows and sorted the 100 matches. This justified
`jobs.0003_job_cursor_created_index`, a B-tree on created_at DESC, id DESC.
Row-value comparison permits the new keyset plan to seek at the boundary.
The repaired plan uses jobs_cursor_created_idx with a ROW boundary and reads
20 index rows instead of sorting/emitting 1,120 rows (21 versus 60 shared hit
blocks in the working-tree run). The regression asserts the indexed boundary
and actual 20-row scan, without timing thresholds, and prints EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) for both paths;
final measured plans and identities are recorded in the external delivery logs.
Public job preview requests use two SQL queries rather than three by omitting
the count; serializers retain bounded relation prefetch. No latency SLA or
constant-time arbitrary substring search is claimed. Other filters and joins may
still require scans; no speculative additional indexes are added.

## Verification and limits

New HTTP regressions cover complete 1,200-row tie traversal, sizes, malformed and
expired tokens, empty collections, query counts/no COUNT/OFFSET, caller/path/filter
binding, role denial, revoked company access, admin access, insert/delete between
pages, draft visibility, exact job lookup and default envelope compatibility.
Existing legacy-array/page tests remain unchanged. Frontend regressions cover
bounded preview calls, exact lookup and retired responses. Chromium verifies
count-free skill presence and independently retains the 21-skill count assertion
through the existing page API. Existing native session, queue, cross-tab, deadline
and permission tests remain required.

Acceptance commands (frontend directory for npm; repository root otherwise):

- `npm ci`, `npm test`, `npm run lint`, `npm run build`
- `backend/.venv/bin/ruff check backend`; changed Python formatting and changed
  method formatting where surrounding baseline formatting is preserved
- isolated validator environment: `python scripts/validate_openapi.py`
- backend directory: `.venv/bin/python -m unittest config.test_e2e_safety_unit config.test_e2e_runtime_unit`
- `backend/.venv/bin/python backend/run_browser.py` (includes fresh migrations,
  Django check, makemigrations --check --dry-run, full pytest and Chromium)
- `backend/.venv/bin/python backend/run_browser_concurrent.py` (two independent
  clusters/services, peer rejection, full suites and owned cleanup)

Results, tested tree, commit and CI identities are external to the tested export.
No development database or devjobs_test is used. Initial runs failed due to invalid
new test fixtures (owner removal, profile/role conflict and missing full_name),
not weakened production invariants; failed-run resources were cleaned.

M-06 compatibility work is reviewable, but universal boundedness is **not**
claimed: legacy arrays and existing numbered-page counts/offsets remain available
for compatibility. Their retirement/default migration needs an owner-approved
version/deprecation policy and UI navigation/total decisions. No silent default
change or public breaking change was made. Cursor traversal is not a transaction
snapshot: deletions disappear, inserts before the boundary require a restart,
and mutable names/visibility can move rows. Nested collection payloads remain
proportional to each returned record's skills/history. Production index rollout,
search-specific measurements and operational limits require representative load
and deployment planning; no deployment is performed here. M-02/M-11 remain out
of scope.

Cursor application retrieval always uses applied_at DESC/id ASC, ignoring the
legacy OrderingFilter input so nullable/nonunique user-selected fields cannot
skip ties or produce invalid seek boundaries. Page-mode ordering is unchanged.
