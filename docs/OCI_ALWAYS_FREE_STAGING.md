# DevJobs — OCI Always Free staging plan (proposed, not provisioned)

**Status: PLAN ONLY / BLOCKED ON OCI TENANCY ACCESS AND CAPACITY.** Baseline: `main` at `53ed2fdf892f82305165aef2d9c639b338be595e`; final hosted frontend and Chromium CI passed. This plan does not approve staging release or production use.

## Source-verified current Always Free limits (19 November 2026)

Oracle's official documentation now specifies **1,500 Ampere A1 OCPU-hours and 9,000 GB-hours per month**, equivalent for an Always Free tenancy to **2 OCPUs + 12 GB RAM total** (not older 4 OCPU/24 GB claims). Create eligible instances in the tenancy's **home region** only; stock may be unavailable. **200 GB combined boot+block storage** and up to **five included volume backups** are shared across resources. Always Free Object Storage is **20 GB total**, with request limits. Idle instances may be reclaimed. Resources above allowance, wrong region, unmarked/paid services and future account upgrades can incur charges.

Authoritative sources:
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
- https://ubuntu.com/docs/oracle/oracle-how-to/find-ubuntu-images/

Before any provisioning, use the OCI console to check the current free-eligible shape, tenancy limits, stock in the **actual home region**, storage use, and resulting cost estimate. Do not convert to Pay As You Go to work around capacity without explicit authorization. Avoid trial-only/chargeable resource defaults. No OCI account or capacity was verified in this work.

## Proposed minimum architecture (single-host staging)

- **OCI VM.Standard.A1.Flex / AArch64 (Arm64)** with **2 OCPU and up to 12 GB RAM**, Ubuntu **24.04 LTS Arm64** if an Always Free-eligible image is available. Use one VM initially, rather than making assumptions about second VM availability.
- **Disk:** 50 GB boot volume initially; add **only** the necessary free-eligible block volume for database and private resumes after reviewing the 200 GB total allowance and existing usage. A locally mounted disk is *not* a backup or automatically highly available.
- **Backend:** Python 3.14 compatibility as verified in current GitHub Actions; deploy Django DRF under Gunicorn with controlled worker count and resource limits. Verify all pinned binaries/wheels on `aarch64` in a clean build; x86_64-built virtualenvs or images are **not** reusable. Do not assume every Python dependency has a compatible Arm wheel without testing.
- **Frontend:** build the Vite/React app with the actual public API URL; serve immutable `dist/` and Django collected static assets via NGINX. Simplest staging topology: same HTTPS origin, `/api/` and `/admin/` forwarded to Django, SPA fallback only for frontend paths. Never expose private resumes through NGINX, static, media routes or object URLs.
- **Data services:** locally installed PostgreSQL **17 with current security patch** and locally installed Redis with durable enough cache availability for login throttling; bind both to loopback or private interfaces only. PostgreSQL and Redis must **never** be internet-accessible. Do not treat Oracle Autonomous Database as a substitute for PostgreSQL.
- **Resume files:** shared persistent local private directory (single-node only), permissions 0700 directory / 0600 objects, configured `PRIVATE_RESUME_ROOT` outside static/media. Provision durable block volume first. If using a different backend later, obtain a separately reviewed adapter and operator-approved exclusive write/read/delete test.
- **TLS/SSH/network:** OCI VCN and security lists permit only HTTPS 443 (and 80 if needed for certificate issuance/redirect) publicly. SSH 22 restricted to operator-approved source CIDR, never broadly enabled by default. No direct public Gunicorn, PostgreSQL, Redis or admin debug listeners. Validate TLS termination, forwarded header stripping, CORS/origins and HTTPS redirect; enable HSTS only after verifying HTTPS. Domain ownership/certificate issuance are external operator requirements.
- **Secrets:** never commit secrets, real contact info, SSH private keys or credentials. Use restricted delivery to the VM; `DJANGO_SECRET_KEY` must be stable and strong, `DATABASE_URL`, `DJANGO_CACHE_URL`, `DJANGO_ALLOWED_HOSTS`, HTTPS/security options, and `PRIVATE_RESUME_ROOT` must pass `production_config` and `manage.py check --deploy`. Provision admin identity through a trusted operator action; do not generate sample administrator credentials.

Single-node Django+PG+Redis+storage has common-mode failure and limited capacity; do not market as high availability, automatic backup, or production-grade. Monitor disk, RAM, 5xx, PostgreSQL, Redis and readiness.

## Free-tier and safety checks before provisioning

1. Confirm the user's OCI account exists, is accessible via an authorized operator, and identify the **home region**. Never request passwords, access tokens or SSH private keys in chat. Account or VM availability cannot be determined through the public web.
2. Confirm the exact **Always Free Eligible** instance/image and allocate **no more than 2 A1 OCPUs + 12 GB RAM** across the tenancy. Check any existing A1 instances before provisioning.
3. Review VM boot and attached disk storage so cumulative volumes are **at most 200 GB**, including existing boot volumes. Check volume-backup allowance, Object Storage quotas and traffic/egress. Enable cloud billing alerts/quotas if available; no guarantee of zero charge outside the eligible plan.
4. Verify isolated staging namespace and non-production credentials, no public personal data, and an operator cost ceiling. Explicit approval is required before billable creation, domain changes or accessing account resources.
5. If Oracle reports **out of host capacity**, record the error and try a different availability domain **within the home region**. Do not silently switch to paid instance shapes or another region.

## Staging rollout checklist (after resources are provisioned/authorized)

1. Create a reviewed, reproducible Arm64 build (no example passwords/realistic-looking credentials), run full backend/frontend tests and enforced `npm audit` / Python security inventory against the immutable artifact. Capture SHA and package versions.
2. Harden OS access, non-root services, package updates, firewall, encrypted/restricted disks and logs; keep DB/cache private. Choose systemd-managed services or another single documented process supervisor after architecture approval.
3. Make an encrypted **paired PostgreSQL+private-resume** backup with all writers stopped. Rehearse restoring both to a **fresh isolated target**, verifying resume byte integrity, row counts, permissions and audit triggers; source-node-only backup is insufficient against VM loss. Record measured RPO/RTO and access to keys. Confirm separate off-node backup target and quota before any real user data.
4. On isolated restore, inspect migration plan; apply through `accounts.0005_authsession` **before** coordinated cutover to new JWT workers. Legacy tokens without `sid` intentionally require one-time re-login. Do not apply production migrations from this plan or reverse immutable-audit triggers casually.
5. Run HTTPS smoke (API+SPA deep links, static/admin, health/ready, login/logout, candidate upload/apply, recruiter publish/review/close, denial tests). Storage operator separately verifies create-if-absent, read byte equality, delete/absence **in an isolated, approved namespace** using runtime identity. Ordinary readiness intentionally does not write storage.
6. Simulate safe failures only in isolated staging, verify 503/readiness, alerts, rollback plan, and explicit operator signoff. Keep source artifacts, DB/private storage backup pair and evidence. No live deployment or state changes have been performed.

## What is still missing

- Actual OCI tenancy/home region/free-tier availability and permission to provision.
- Staging hostname/domain, operator identity and cost ceiling.
- SSH public key (not private key) to install via an approved mechanism; real secrets through secure storage, not here.
- Chosen off-node paired backup destination, monitoring/alert contact route, and migration maintenance plan.
- Provider-specific provisioning, secure image/build/CI steps, direct HTTPS evidence, storage gate and restore drill.

**Go/no-go:** integrated source CI PASS; **staging infrastructure and release acceptance NOT VERIFIED/BLOCKED**.

See `docs/PRODUCTION_DEPLOYMENT.md`, `docs/M11_STORAGE_VERIFICATION.md`, `docs/STAGING_READINESS.md` and Issues #6 / #13.
