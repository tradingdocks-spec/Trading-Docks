# Production recovery readiness — September 21, 2026

**RECOVERY READY — Supabase-compatible database restore successfully rehearsed and verified on September 21, 2026.** No production repair migrations, merge, deployment, POS enablement or Square configuration occurred. The four-file schema-first repair remains unchanged and requires the next owner approval before execution. The historical failed attempts below are superseded by this verified result.

## Successful Supabase-compatible rehearsal

After the owner repaired Docker startup, a dedicated local Supabase project, `trading-docks-recovery-test`, was initialized outside the repository. Production and staging were not restored over or changed. The existing unrelated local Supabase project was not touched.

Target: official `public.ecr.aws/supabase/postgres:17.6.1.167`, PostgreSQL 17.6 on Linux. Production uses PostgreSQL 17.6 / Supabase build 17.6.1.147. All installed extension versions match:

| Extension | Production and target |
| --- | --- |
| pg_stat_statements | 1.11 |
| pgcrypto | 1.3 |
| plpgsql | 1.0 |
| supabase_vault | 0.3.1 |
| uuid-ossp | 1.1 |

The CLI initially bootstrapped Auth v2.196.0, which lacked a production MFA table. Its attempted restore rolled back. The isolated target was then bootstrapped with official Auth v2.197.0; both Auth migration heads became `20260831180000`. The local Storage bootstrap image is v1.72.1 versus the recorded source v1.73.1: bucket/object counts, all four managed Storage trigger identities, and the six restored custom policies were verified; Storage HTTP/file operations were not exercised. This is database recovery validation, not a full platform/media-service acceptance claim.

### Additional backup set

Original `production.dump` and `roles.sql` remain unchanged at their original location, sizes and timestamps; their SHA-256 checksums were reverified after the successful rehearsal.

Additional owner-controlled, access-restricted directory outside Git:

`C:\Users\Jerem\TradingDocksRecovery\trading-docks-supabase-aware-20260921`

Supabase CLI 2.117.0 successfully executed separate role-only, schema, COPY data, and explicit `supabase_migrations` schema/data exports. All dump commands exited 0. Export interval: **21:13:10–21:14:56 UTC**; application data export completed **21:14:27 UTC**. These separate commands are not a single cross-file snapshot. Post-export source comparisons matched the restored critical data; refresh/revalidate before a later production maintenance window if the source changes.

| File | Bytes | Purpose |
| --- | ---: | --- |
| roles.sql | 370 | Supabase-aware role settings/grants; no reserved-role recreation/password replay |
| schema.sql | 520,292 | Application schema, functions, types, constraints, indexes, policies and grants |
| data.sql | 277,337,377 | COPY data, including Auth/Storage data and sequence state |
| history-schema.sql | 1,116 | Explicit migration-history schema |
| history-data.sql | 57,649 | All 12 production migration records |
| managed-customizations.sql | 2,942 | Six Storage policies and the Auth user-created trigger, extracted from the preserved raw archive and verified against current source definitions |
| source-api-acl.sql | 209,936 | Read-only source-catalog ACL snapshot for exact restoration of application API privileges |

The secure directory's `manifest.json` records full SHA-256 hashes and UTC times for every file. Main COPY data SHA-256:

`24E61C0D40B4FEBC65D959AF934F1D0C3002AAE5426FFDE4F1547F6DD23C1117`

No database contents, role SQL, access tokens, encrypted marketplace credentials, private verification captures or backups were committed. Only this non-sensitive evidence report is in the repository.

### Restore method and isolation

The empty target was bootstrapped first. Before loading production data, all Auth/Storage/API/mail/worker services were stopped, and every Docker network attachment was removed from its database container. Verification confirmed an empty network attachment map. Only `docker exec` was used for database access; no Vercel or application environment was pointed at it. No production SMTP/webhook/Square/marketplace service configuration or application encryption key was provisioned. Production Vault contains zero secrets. Existing encrypted credential rows are retained as database data, without an application runtime or key to execute integrations.

Restore used the local Supabase platform administrator, `psql --single-transaction --set ON_ERROR_STOP=1`, in this order: roles, schema, transaction-local `session_replication_role=replica`, data, history schema/data. The primary restore completed with **exit 0 at 21:18:01 UTC**, approximately 13 seconds after starting. The replica setting applied only to that disposable restore session; later verification confirmed `origin` and zero disabled application triggers.

Managed customizations were restored separately with exit 0. A fresh target's default grants added unwanted anonymous table and authenticated function privileges despite otherwise correct schema restoration. The captured source ACL supplement restored the **exact source permissions**, with exit 0; no source authorization was weakened. Final ACL comparison has zero differences. The unmodified raw dump remains retained; the target was corrected through explicit restore supplements, not by fabricating platform functions or accepting skipped errors.

After verification the database container was stopped. All recovery services are stopped, and the dedicated Docker volume retains the recovered database. Do not use `supabase start` casually on this recovered project: it can reattach networks/start APIs. Any further inspection must retain the isolation controls. No emails, external webhooks or real integrations were invoked.

### Restored verification

| Check | Restored result |
| --- | ---: |
| Inventory rows / units | 1,515 / 1,788 |
| Inventory events | 1,550 |
| Workspaces / memberships | 5 / 5 |
| Auth users / identities | 5 / 5 |
| Chaos batches / sessions / positions | 22 / 22 / 1,488 |
| Inventory locations / label identities | 5 / 26 |
| Migration-history rows | 12 |
| Storage buckets / object metadata rows | 3 / 31 |
| Unscoped inventory, intentionally still pre-repair | 1,489 |
| Missing Auth users for workspace memberships | 0 |

Full-row fingerprints matched the read-only source for all 12 critical tables covering inventory, events, workspaces/members, Chaos, locations, label identities, migration history and Auth users/identities. This includes ownership and all recorded relationship fields, not just aggregate counts.

Exact source/target comparisons passed for **79 public functions, 195 public/Auth/Storage policies, 133 public-table RLS settings, 29 application/custom Auth triggers, 3 enums, 272 public types, 1,818 columns, 711 constraints, 398 indexes, 4 public sequences, 137 table/sequence ACLs and 79 function ACLs**. Catalog comparison used the same `search_path`; 64-bit sequence limits were compared as strings to avoid JSON numeric rounding. No actual policy or sequence mismatch was concealed by those representation corrections.

Read-only authenticated usability passed: the canonical owner sees 1,514 inventory rows, 1,787 units, four locations, 22 batches, 1,488 positions and 25 label identities; the other inventory owner sees one row and zero foreign-owner rows. Anonymous inventory SELECT is denied. The Chaos commit RPC exists with the source definition; no commit was invoked. Label identity reads and current prerequisite-column checks match the source **pre-repair** shape, including its known missing identity-position column. Recovery reproduces that state; it does not restore Label Studio's functionality by applying the pending repair.

### Corrected future recovery procedure and limits

Use the Supabase-aware export set **plus explicit migration history, managed customizations and a source ACL snapshot**, not the raw custom archive alone. Provision compatible platform roles/extensions and the matching Auth schema; restore transactionally, apply the reviewed restore supplements, compare effective grants/RLS and data, and verify read-only usability. Preserve the original raw archive as additional evidence. The local platform administrator was needed for a platform parameter grant in the role export; a hosted restore must use that target's supported privilege-handling process and must be rehearsed separately rather than assuming local superuser access exists there.

Storage file payloads, Vercel settings, application secrets, custom login passwords, external integrations and full hosted-service disaster recovery are outside this database-only proof. Vault was empty; nonempty Vault or column-encryption recovery would require a separate key-recovery check. The source's encrypted application credential values are preserved, but credential decryption/use was deliberately not tested. This is a local owner-controlled copy, not verified offsite or encrypted-disk disaster protection.

The data restore itself took about 13 seconds after bootstrap; full environment provisioning, supplements and verification took longer. Do not treat that as a production recovery-time guarantee. Keep the verified artifacts and manifest, recheck source drift/backup freshness before eventual execution, and obtain owner approval before any production restore or compatibility migration.

**Current gate: RECOVERY READY for the verified Supabase-compatible database backup set. Stop at owner approval.**

## Historical blocked target follow-up — superseded

The subsequent authorized Supabase-compatible validation attempt remains **BLOCKED / NOT READY**:

- The existing Trading Docks organization quoted $0/month for a new project. Creation of `trading-docks-recovery-test` was attempted in `us-west-1` (the creation connector did not offer production's `us-west-2`). Supabase rejected creation because the organization owner has reached the two-active-free-project limit. **No project was created.** Production and staging were not paused, deleted or upgraded.
- Local Supabase remains unavailable because Docker Desktop fails during ingest socket initialization. The stale local socket could not be renamed. Automatic approval review rejected its removal as “blocked by policy”; no alternate removal mechanism was attempted.
- Neither a hosted nor local Supabase-compatible database was provisioned. Therefore extension comparison, restore, restored row/ownership/Auth relationships, RLS, function, trigger, enum, migration-history and usability checks remain **NOT RUN**, not PASS. No stock PostgreSQL result is being substituted for this gate.
- No runtime backend was changed, no external-service secrets were provisioned, and no target capable of sending production emails/webhooks or using marketplace/Square credentials was created.
- The original custom archive and role dump were rechecked: both SHA-256 checksums, file sizes and modification timestamps still match the evidence below. Access restriction remains in place. Neither backup was deleted, overwritten or committed.

An additional three-part Supabase CLI backup has **not** been created: its supported execution requires the unavailable local Docker runtime. The raw archive remains evidence, not a verified long-term platform restore recipe. Once a compatible runtime is available, retain the originals and capture separate CLI role-only, schema and data-only exports; explicitly include migration-history schema/data and review Auth/Storage customizations, Vault material and excluded platform internals per current Supabase guidance. Record a fresh snapshot/baseline and rehearse the resulting restore before declaring readiness.

Owner action needed: make a disposable hosted project slot available without disrupting production/staging, or repair Docker startup outside this task's blocked removal action. Paid-plan changes were not authorized or performed. Target creation alone will not satisfy the gate: successful platform-compatible restore and verification are still required. Do not begin production migration afterward without returning to owner approval.

## Recovery options checked

Production project: Trading Docks (`bohddnajlnmknngzjsjk`), PostgreSQL 17.6, us-west-2.

| Option | Observed status |
| --- | --- |
| Managed Supabase backup | CLI returned `backups: null`, empty physical backup metadata; no recovery point listed |
| PITR | Disabled |
| WAL-G | Enabled, but no independently verified recoverable point |
| Existing organizational restore mechanism | None established by the available evidence |
| Supabase CLI dump | CLI authenticated and generated the connection/dump plan; Docker engine unavailable |
| Native logical PostgreSQL backup | Completed using PostgreSQL 17.11 `pg_dump` and `pg_dumpall` |

No managed backup/PITR purchase or project setting was changed. Docker Desktop was started for local tooling but exited before readiness. Its diagnostic identified a local ingest socket initialization/rename failure. No reset or deletion of Docker state was attempted.

## Backup artifacts and integrity

Owner-controlled directory, outside the repository:

`C:\Users\Jerem\TradingDocksRecovery\trading-docks-production-pre-pos-repair-2026-09-21T2105Z`

The recovery parent directory has inheritance removed and explicit full access for the current Windows owner and SYSTEM. Database contents, role SQL, archive manifest and private logs remain there, not in Git or this document. The temporary CLI connection-plan file containing connection credentials was removed after use. Local disk encryption/offsite replication was not verified.

| Artifact | Format | Bytes | Command result |
| --- | --- | ---: | --- |
| `production.dump` | PostgreSQL custom archive, gzip | 43,801,118 | `pg_dump` exit 0; empty error log |
| `roles.sql` | SQL roles/memberships, no role passwords | 6,173 | `pg_dumpall` exit 0 |

Archive start: **2026-09-21 21:03:22 UTC** (14:03:22 America/Phoenix). Database archive finished: **21:03:52 UTC**. Roles finished: **21:04:14 UTC**. Roles were captured separately, not under the database archive's snapshot. No verified restore timestamp can yet be declared.

SHA-256:

```text
production.dump
2BA290B8075BB03BB3CBE248635361A9818203D69C7ADC30CC4C012FA3543D0E

roles.sql
93DEBA67858A97B67FB43E781B1A77E6B3DE47931E06E07E7F6D2746EA21BCA6
```

`pg_restore --list` exited 0 and recognized 2,209 archive entries. The archive contains public application objects, Auth, Storage, Realtime and `supabase_migrations`, including inventory and inventory-event table data and migration-history data. Object categories inspected: 172 table-data entries, 123 functions, 34 triggers, 195 policies, 158 row-security entries, 345 ACL entries, 13 sequence entries and 18 types. These are archive-entry counts, not a successful restore assertion.

The native dump did not use the CLI's default exclusion of managed schemas. It includes Auth/Storage definitions/data as captured by `pg_dump`, but extension-owned internals retain PostgreSQL extension dependency semantics. Required extensions include `pg_stat_statements`, `pgcrypto`, `uuid-ossp` and `supabase_vault`.

## Isolated restore attempt

A new password-authenticated PostgreSQL 17.11 cluster was initialized outside the repository, bound only to `127.0.0.1:55469`. It is separate from staging and production. Restore commands used transaction/error-stop controls.

1. Role SQL restore exited **3**. Supabase-managed membership replay failed: grantor `supabase_admin` lacked the required ADMIN option on `anon` in this stock PostgreSQL environment. The role transaction rolled back.
2. Full archive restore exited **1**. It could not assign the Auth schema to the absent `supabase_admin` role. The database restore transaction rolled back.
3. The disposable database server was stopped. No restored application state is claimed. The archive was not edited, grants were not weakened, and platform functions were not replaced with stubs to produce a false PASS.

This proves that the stock PostgreSQL bootstrap used here is insufficient; it does not prove the archive is corrupt. A correctly provisioned, isolated Supabase-compatible target is required to rehearse platform roles, extensions and managed schema ownership. Native Windows PostgreSQL alone also does not supply the `supabase_vault` extension.

## Row-count evidence

A separate **read-only source check after the dump**, not a restored/snapshot comparison, returned:

| Source measure | Count | Restored verification |
| --- | ---: | --- |
| Inventory rows | 1,515 | NOT VERIFIED |
| Inventory quantity total | 1,788 | NOT VERIFIED |
| Inventory events | 1,550 | NOT VERIFIED |
| Workspaces | 5 | NOT VERIFIED |
| Workspace memberships | 5 | NOT VERIFIED |
| Migration-history rows | 12 | NOT VERIFIED |

Chaos Sort objects, existing pre-repair label objects, RLS, functions, triggers, grants and relationships are represented in the archive but have **not** passed restored-database checks. The earlier sanitized compatibility rehearsal is not a substitute for restoring this actual backup.

## Recovery limitations and next procedure

Supabase-managed Auth/Storage customizations and migration history need explicit preservation during a platform-compatible restore. Database backups do not contain Storage file payloads. Roles were exported without passwords; authentication/connection secrets and application configuration require separate secure handling. Vault/column-encryption recovery may require the original encryption root key; its recoverability has not been established. See the official [backup/restore guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) and [database backup limitations](https://supabase.com/docs/guides/platform/backups).

Required next steps:

1. Establish a working isolated Supabase-compatible runtime (repair local Docker startup or use a separately authorized disposable target). Never overwrite staging acceptance state.
2. Provision the platform roles/extensions with the target's supported bootstrap; review grantor/ownership mapping without changing source authorization semantics. Preserve the original archives and checksums.
3. Restore roles and archive through the supported target procedure, failing on errors; preserve migration history, managed schema customizations, RLS and grants. Account for Vault encryption material and external Storage objects.
4. Verify restored counts, ownership/workspace distributions, relationships, functions, triggers, policies, sequences and grants. Check actual inventory, event, Chaos and label queries against the restored database.
5. Record an actual successful restore duration and verified recovery point. No restore-time estimate is supported by the failed attempt; allow a separate rehearsal window rather than assuming the 30-second dump duration predicts recovery time.
6. Refresh the backup and revalidate if production changes before the eventual migration window. Even after recovery passes, return to owner approval; do not begin the four-file repair automatically.

**Gate: RECOVERY NOT READY — backup created, restore rehearsal failed.** No production restore or migration is authorized by this report.
