# M-09 bounded Axios and refresh lifetimes

Baseline authenticated and refresh Axios defaults are timeout=0. The frozen
baseline default-deadline regression fails (expected 30000, received 0):
/tmp/devjobs-m09-red.log. A transport, interceptor or session lock that never
completes can otherwise retain an unresolved UI operation or shared refresh.

Authenticated/public-auth requests default to 30 seconds, shared refresh to ten
seconds, and refresh-failure expiry coordination to five seconds. A positive
per-call timeout can override the ordinary request default; zero/nonfinite values
use the finite default. Axios receives a finite transport timeout and a deadline
AbortSignal. The outer race also bounds interceptor queues and noncooperating
adapters. Retried requests preserve their original deadline. Timers and listeners
are removed on completion or cancellation. Plain refresh transport defaults to
ten seconds and its shared flight remains bounded through token commit.

Session dispatch, refresh commit and expiry accept cancellation signals at the
Web Locks boundary and recheck them inside the acquired callback. Native queues
can be canceled, and a callback released after cancellation cannot send or write
credentials. Late responses recheck cancellation before any refresh or retry.
A timed-out shared flight is released so a later session can recover. One
request's view cancellation does not cancel the independent shared refresh for
other still-current consumers. Existing permit/revision and epoch checks remain.

No mutation is automatically replayed after timeout/cancellation. The existing
single retry following a valid 401 refresh remains, within the original deadline.
Once dispatched, server effects may still complete; timeout does not establish
whether a mutation committed. If an external lock prevents both refresh commit
and bounded expiry, the request fails without a late credential write; the
canonical record remains unchanged until a subsequent coordinated operation.
This changes wait bounds, not JWT lifetimes, revocation or account policy.

Twenty focused tests cover finite defaults, noncooperating operations, original
retry deadlines, timer disposal, pre-cancellation, real Axios mutation no-replay,
shared refresh timeout/recovery, queued interceptors and late credential commits.
A new Chromium scenario holds a native exclusive Web Lock and verifies the
queued mutation times out without dispatch or session replacement. Existing real
Axios/session, native cross-tab, refresh continuity and callback tests remain.
An initial test passed an ignored credentials argument to expire; the new optional
signal uses an options object so that historical internal call still behaves as
before. No security assertion or timeout was weakened.

Commands: frontend npm test -- src/features/auth/requestDeadline.test.js
src/features/auth/api.test.js src/features/auth/sessionStore.test.js; npm test;
npm run lint; npm run build. Exact-export acceptance includes all PostgreSQL 17,
Chromium standalone/concurrent, peer, runner-safety, Django/migration, Ruff and
OpenAPI gates. Final results/tree/commit identities remain external. No backend,
public API shape, schema, dependency, production setting or JWT policy change.

Recovery review reproduced an exhausted-deadline defect: a zero-delay timer
could run after the operation had already dispatched. An elapsed original
deadline now aborts synchronously before invoking the operation. The failing
regression is retained at /tmp/devjobs-resume-m09-focused-red.log. Additional
fake-clock tests cover invalid timeout values, actual Axios refresh/retry
budget retention, independent shared-refresh consumers, replacement credentials,
logout/provider retirement, refresh-interceptor stalls and subsequent recovery.
No wall-clock sleeps or increased timeouts are used.
