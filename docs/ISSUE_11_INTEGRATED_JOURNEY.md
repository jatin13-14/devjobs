# Issue 11 integrated journey

The existing disposable PostgreSQL and Chromium workflow exercises candidate,
recruiter and administrator actions against the real API. Job editing and closing
are performed in the recruiter UI; application, status, withdrawal and job changes
are checked after reload. Member authorization is also checked against the API.
Production-bundle mode selects this workflow alongside the route suite.

Working-tree verification on 2026-11-18: the focused workflow passed, followed
by development Chromium 85/85 and production-bundle Chromium 76/76. Each owned
PostgreSQL 17 run passed 221 backend tests with 11 optional Redis skips, and
reported cleanup. The workflow waits for the successful job update response and
the exact preview navigation before checking persistence after reload.

Frozen-export acceptance remains pending. The inherited picomatch audit gate
remains enforced and currently fails; no exception is implied.
