# Stage 2C collection consumer audit

The final legacy-array consumer in production frontend code was the candidate
dashboard GET /candidates/me/skills/. It needed only existence for profile
completion, yet downloaded every skill. It now requests pagination=page, page=1,
page_size=1 and passes results to the existing completion calculation. Applications
and public jobs previews explicitly request page=1, page_size=3, matching the
three rendered rows. No subsequent pages or server-provided next URLs are fetched.

| Consumer | Collection behavior after migration |
|---|---|
| Candidate dashboard | One skill; three applications and jobs per preview |
| Candidate skills and profile | Own skills, explicit opt-in, 20-row pages |
| Company management | Members, explicit opt-in, 20-row pages |
| Company directory, picker and membership resolution | Explicit opt-in, bounded discovery pages and exact company-ID lookup |
| Job discovery/company jobs/applicant lists/candidate applications/admin lists | Existing always-paginated envelopes |
| Recruiter dashboard and protected job lookup | Existing sequential page traversal; each response bounded, total work still grows with collection size |

Production frontend collection calls were audited with rg over http.get and
jobsApi usage. Test/browser fixtures intentionally retain legacy requests as
compatibility assertions. Backend collection_response, routes, OpenAPI oneOf,
legacy arrays, ordering, authorization and mutation contracts are unchanged.
No retirement policy is approved: missing pagination must still return arrays.
M-06 therefore remains open for external clients and COUNT/deep OFFSET/concurrent
write drift. M-07 recruiter aggregation still has unbounded total traversal;
it must not report first-page totals as company-wide totals.

Dashboard regressions assert bounded request parameters, nonempty skill presence
with count=101 and an untrusted next link, unchanged empty/completion behavior and
no follow-up traversal. Chromium verifies the actual dashboard gets one skill
from a 21-skill collection and renders. Existing mobile/keyboard and role/security
workflows remain required. No new API/schema/migration/dependency/product scope.

Commands: frontend npm test -- src/features/dashboard/CandidateDashboard.test.jsx;
npm test; npm run lint; npm run build. Exact-index export must also pass owned
PostgreSQL 17 standalone/concurrent Chromium, peer isolation, Django/migrations,
Ruff, OpenAPI and runner-safety gates before commit. Results/identities are
recorded externally so the tested tree remains stable.
