# CI isolation and action integrity

Recovered local CI changes pin checkout v4, setup-python v5, setup-node v4 and
upload-artifact v4 to reviewed full commit identifiers. Each pin was checked
against its upstream tag with git ls-remote; no third-party action is introduced.
Checkout disables credential persistence. Workflows have read-only contents
permissions and bounded 15-minute jobs. Artifact policy remains synthetic failure
PNGs only, retained three days; no traces, JWTs or network logs.

Backend CI now calls run_browser.py --backend-only. It uses the same owned
PostgreSQL 17 cluster, independent identity verification, environment sanitization,
migrations/checks/pytest and cleanup as browser acceptance, then returns before
browser fixtures, services and Playwright. It does not use devjobs_test or any
existing database. Normal standalone/concurrent browser runner behavior remains.
No deployment topology, production settings, throttles, dependency or API change.

Verification includes parsing all workflow YAML, asserting action pins,
permissions, bounded jobs, disabled credential persistence and the backend-only
command, a live backend-only owned-cluster run, Ruff/formatting, pure runner
safety tests and full exact-export frontend/backend/browser acceptance. The
backend-only log must contain the backend PASS/cleanup markers and no browser
ownership or Playwright startup markers. Hosted CI is observed separately.
