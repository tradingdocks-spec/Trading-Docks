# Production recovery readiness — September 21, 2026

**RECOVERY NOT READY.** A full logical database archive exists and passes file/archive inspection, but the isolated restore rehearsal did not succeed. No production repair migrations, merge, deployment, POS enablement or Square configuration occurred. The approved four-file schema-first plan remains unchanged and must not start on the strength of this archive alone.

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
