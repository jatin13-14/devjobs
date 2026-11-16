# Stage 2B.5 F-04 permission invalidation

Follows F-03 commit 1e8193bb1b13636efa82dc163a151533ff7c9366.

The controlled publish-denial UI regression fails on the requested original
baseline: a management HTTP 403 leaves Publish/Edit controls active and never
revalidates exact membership. Evidence: /tmp/devjobs-2b5-f04-red.log. The repaired
regression resolves OWNER initially, denies publish, resolves MEMBER and verifies
that controls disappear.

useCompanyMembership now owns an invalidatable session/view capability per
membership resolution. A known management denial synchronously retires that
capability before revalidation. Retained callbacks and queued Axios requests
cannot use it again. Job create/edit/publish/close, applicant reads/status updates,
resume downloads and member-list reads carry its transport authority. Known
company-job read denials also invalidate membership. Existing company mutations
retain their immediate action invalidation and revalidation. Pending/failed
membership resolution clears private management subtrees and membership forms.

An active visible workspace revalidates every 60 seconds. Focus/visibility return
revalidates if the last successful resolution is at least five seconds old.
Hidden tabs do not poll; visible return triggers a check. This bounds external
OWNER transfer, ADMIN demotion, membership suspension/removal or company suspension
detection in an active visible tab to the refresh interval plus request time;
there is no instant notification guarantee. Server authorization remains decisive
for every request. Network errors require Retry. One automatic revalidation is
allowed for consecutive management denials; a second denial without a successful
management request produces an error rather than another automatic loop.

Tests cover OWNER-to-ADMIN transfer (retiring OWNER callbacks even though ADMIN
can still manage), MEMBER demotion, empty exact membership, known denials,
retained callbacks, visible refresh and repeated-denial loop prevention. A real
Axios request queued before invalidation is rejected before adapter dispatch.
Existing membership mutation, account/company replacement, role, resume download
and applicant tests remain required. Legacy mocks now verify authority configs.
The initial timer test accidentally intercepted Testing Library's polling timer;
it now intercepts only the 60-second application interval. Initial full-suite
failure was an obsolete download call-arity assertion, updated to require the
new authority config. Neither failure is an accepted gate.

No backend policy, public API shape, schema, migration, dependency, production
setting or authentication-policy change. API service config additions are internal
frontend transport arguments. Already-dispatched server effects cannot be undone.
F-12 remains pending. Commands and exact exported-snapshot results/identities are
recorded in the external delivery manifest, with the same frontend/backend/browser
acceptance gates as docs/STAGE_2B5_RESPONSE_ORDERING.md. No hosted CI pass is
inferred from local results. Unrelated operations notes remain excluded.
