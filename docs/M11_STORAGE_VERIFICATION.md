# M-11 private storage verification gate

Ordinary readiness must not create, read back, or delete test objects. A
read-only availability check cannot establish that resume uploads or cleanup
will work. The deployment is blocked until an authorized operator verifies
write, read, and delete against the actual private storage configuration.

No provider or storage adapter has been selected for production. Consequently
this repository cannot supply a provider-independent smoke command that safely
guarantees exclusive creation and deletion of only its own object. Do not use
the ordinary resume cleanup command for this check.

Before release, the storage owner must approve a provider-specific procedure
and an isolated, dedicated test namespace with no user objects. Using the same
runtime identity and permissions as the application, the procedure must:

1. Generate an unpredictable object name in that namespace and use an atomic
   create-if-absent operation; stop if exclusive creation is unavailable.
2. Write synthetic non-sensitive bytes, read them back, and compare the bytes.
3. Delete only the object created by this invocation, then verify its absence.
   Report a failure if deletion or verification fails, and retain restricted
   evidence for manual reconciliation by the storage owner.
4. Verify the namespace and permissions cannot overwrite or delete user files;
   record the result and repeat after relevant storage or permission changes.

Run this only in an explicitly authorized operational window, never as part of
the public readiness endpoint. Do not put credentials, object names, or user
data in public logs or source control. A failed or unperformed smoke check is a
release blocker, even if read-only readiness succeeds.

Readiness does not inspect storage or establish storage availability. PostgreSQL
uses a dedicated connection with a one-second transaction-local statement timeout
and a two-second socket-wait deadline; Redis uses configured connect/read timeouts.
These individual limits do not provide an end-to-end request deadline.
