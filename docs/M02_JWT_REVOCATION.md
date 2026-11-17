# M-02 JWT revocation: audit and proposed design

Status: implementation in progress; owner approved legacy-token rejection.
Acceptance and delivery are not yet complete. Original design baseline commit:
`03ce02cf52b1e8ae540fa79722cd8feee21f3a99`; branch `feat/m02-jwt-revocation`.
Existing operations edits in PROJECT_STATUS.md and LOCAL_DEVELOPMENT.md are
unrelated and must remain excluded from the eventual commit.

## Baseline audit

- config/urls.py exposes login and token aliases through
  EmailTokenObtainPairSerializer, plus SimpleJWT TokenRefreshView with a separate
  RefreshRateThrottle. There is no logout endpoint.
- No SIMPLE_JWT overrides or blacklist app are configured. Installed SimpleJWT
  defaults give access tokens five minutes and refresh tokens one day. Refresh
  returns access only, does not rotate, and permits replay until expiry. Login
  adds the safe user representation; canonical email and Django authentication
  reject invalid credentials and inactive accounts.
- Default JWTAuthentication validates signature, expiry and token type and loads
  the user from the database on every authenticated request. Inactive users are
  rejected. Refresh also loads the user and checks activity. The installed
  refresh implementation does not handle a deleted user's DoesNotExist itself.
  Password-change revocation is not enabled. Roles and company permissions come
  from current database state rather than trusted role claims in JWTs.
- Frontend sessionStore persists bearer credentials in localStorage
  (devjobs.auth.v2). Logout replaces that record under a Web Lock; it does not
  contact the server. Epoch/permit/revision checks already prevent late refresh,
  login, queued dispatch and cross-tab results from restoring a replaced session.
  api.js coalesces in-process refresh requests and retains the existing refresh
  token when refresh returns only access. These protections do not revoke a
  copied bearer credential on the server. XSS can read localStorage credentials.
- Production uses shared Redis with bounded connection/socket timeouts. Login
  uses the existing anonymous JWT throttle; registration and refresh use fixed
  window counters, atomic Lua on Redis. Redis exceptions propagate without a
  process-local fallback. Development/test default to local-memory cache.
  Revocation must not weaken any of these limits or readiness checks.
- There is no shared JWT session registry. Independent logins are currently
  unrelated token pairs. Django browser-admin sessions are a separate mechanism.
  Browser runner fixtures and some tests issue RefreshToken.for_user directly;
  these fixtures must use the production session issuer after enforcement.

## Threat model and alternatives

An attacker may copy an access or refresh token, replay it after logout, race
refresh against logout, or retain credentials across account/permission changes.
Requests may reach different workers; storage can be unavailable. Delayed browser
responses must not overwrite a new login. Signing-key compromise, XSS prevention,
and cancellation of already-authorized business operations are outside M-02.

Refresh blacklisting alone cannot invalidate issued access tokens. Per-user
token versions invalidate every session and cannot isolate current-session logout.
Redis session state adds a security-critical persistence/eviction dependency.
PostgreSQL session records use the existing durable primary, support independent
sessions and row locks, and require no dependency or deployment service changes.
Choose PostgreSQL records with a random session ID (sid) in both token types.
Never create a session implicitly during refresh or authentication.

## Proposed semantics

1. Login creates one session row: random UUID, user foreign key, creation time,
   absolute expiry matching refresh expiry, and nullable revocation time. JWTs
   carry sid. No raw bearer tokens or credentials are stored in the row or logs.
2. Protected endpoints retain all SimpleJWT validation and current user checks,
   then require an unrevoked, unexpired session owned by that token's user. Reads
   use the primary database with no revocation cache or read replica.
3. Refresh validates the refresh JWT and locks its session row in a transaction.
   It rechecks activity, ownership, expiry and revocation before issuing access.
   Preserve access-only responses and nonrotating refresh semantics: replay is
   allowed only while the session and refresh token remain valid. No sliding
   extension of the one-day session lifetime is introduced.
4. Add POST /api/v1/auth/logout/ accepting {refresh: <refresh JWT>} without
   requiring a live access token. Validate signature/type/expiry, lock the same
   session row, and mark it revoked. Return 204 only after commit; repeat valid
   logout is idempotent. Invalid/expired credentials receive 401, malformed input
   400. Use the existing refresh throttle class to avoid adding an unbounded
   anonymous write endpoint. A refresh token authorizes only its own session's
   revocation, never another user's or session's.
5. After logout commits, subsequent authentication and refresh checks reject both
   credentials, including access minted by a refresh that won the row lock first.
   If logout wins, refresh fails. An already-authenticated business request may
   finish; logout does not retroactively roll back completed authorization.
6. Independent logins have distinct sessions; revoking one leaves others intact.
   Account disabling rejects all sessions while disabled through live user checks.
   Re-enabling restores otherwise valid sessions unless individually revoked;
   permanent revoke-all on disable is not implied. Roles/admin flags/memberships
   retain their existing live permission semantics, without embedding authority
   in the new claim. Password reset/revoke-all is outside this endpoint's scope.
7. Database failure admits no authenticated requests and issues no tokens. Return
   a sanitized 503 for session-storage failures; logout must not claim success.
   No in-memory fallback. Redis remains a throttle dependency, not revocation
   storage; its failure must continue preventing throttled auth operations.
8. Frontend captures the old session's refresh credential under the existing
   ownership protocol, retires local credentials immediately, and sends only that
   captured credential to logout through a bounded transport. Late logout results
   cannot affect a replacement login. A failed remote revocation must be visibly
   distinguished from confirmed server logout; local deletion alone cannot promise
   stolen-token invalidation. No tokens in notifications, exception logs or URLs.
9. Expired session rows can be removed after their absolute expiry; a missing row
   always rejects authentication. Cleanup must never recreate sessions. No new
   scheduler is required for correctness; row retention is an operational concern.

## Approved compatibility decision

Existing access and refresh JWTs contain no shared session identifier. Their
independently generated jti values cannot safely establish a per-session link.
Backfilling rows from refresh tokens cannot revoke already-issued legacy access
tokens individually. Do not invent such a link or silently claim full revocation.

Recommended cutover: reject JWTs without sid after enforcement is enabled. Users
sign in once again; endpoint names, credentials, user response and access-only
refresh response remain compatible. Apply the migration before serving the new
code and coordinate worker cutover: mixed old/new workers cannot guarantee
revocation because old workers ignore session state. No deployment is authorized.

Alternative: explicitly time-box legacy-token acceptance, preserving login state
but leaving those access tokens unrevocable until expiry. That delays the full
security guarantee and requires a documented cutoff and rollout policy. This
alternative is not selected or implemented.

Repository AGENTS.md requires asking before changing public API compatibility or
the authentication model. The owner approved the recommended legacy-token cutover in the M-02 implementation request.

## Required acceptance after approval

Add actual JWT HTTP tests for issuance, expiry/type/signature failures, revoked
access/refresh replay, idempotent logout, independent sessions, disabled/deleted
users, permission preservation, and legacy rejection. Exercise both refresh/logout
lock orders using independent PostgreSQL connections; verify another authentication
instance observes committed revocation. Inject database and throttle failures and
assert no admission, credentials or false logout success. Exercise real frontend
logout, account switching and late refresh/logout outcomes, including failure UI.

Run the established exact staged-tree export workflow: full frontend tests, lint,
build, backend Ruff/changed-code format, OpenAPI, migration consistency/application,
runner unit checks, standalone Chromium/backend and concurrent runners with peer
isolation on runner-owned PostgreSQL 17.12 only. No skipped revocation test counts
as evidence. PostgreSQL is the proposed mechanism, so no Redis revocation suite
is necessary; existing optional Redis throttle coverage must be reported honestly.
Verify owned-resource cleanup and export/staged/committed tree equality, then push
and create a separate draft PR targeting fix/p0-candidate-pages. Record commit/tree identities and hosted CI
outside the tested tree. Do not merge, deploy or alter other PR targets.

## Implementation in progress (2026-11-18)

The approved cutover rejects tokens without `sid`. Session rows are issued on login;
refresh and logout serialize on the session row, and protected requests check the
current session. Logout clears local credentials before attempting remote revocation;
a failure is displayed to the user. This work is not yet accepted or delivered.
The target for the eventual stacked PR is `fix/p0-candidate-pages`.
