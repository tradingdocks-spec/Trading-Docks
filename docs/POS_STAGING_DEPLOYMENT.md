# POS isolated staging deployment

Status: **Implemented — isolated Preview deployment; real Square external acceptance remains pending**.

Ready deployment: `dpl_GhbTtR7pvgvtTXn3Cb49qCbr3eWd`, source commit `42bcc15`, September 21, 2026. The stable staging alias is public; other deployment URLs retain their existing protection.

Owner authorized staging-only deployment fixes on September 21, 2026. Production remains excluded.

## Isolation

- Vercel project: `trading-docks-346a`; branch: `codex/pos-foundation`; target: Preview.
- Stable staging origin: `https://trading-docks-pos-staging.vercel.app`.
- Supabase: `ukrcbmujzdyclrkghbvo` only. Branch-specific public URL/key and service-role overrides replace inherited values for this branch. No migrations are applied by deployment.
- Inherited email, shipping, AI and unrelated integration credentials are blanked for this branch. Production records are preserved.
- Automatic Git deployment is disabled for this branch in `vercel.json`, preventing a push from deploying before its configuration is reviewed. Deploy explicitly with `vercel deploy --target preview`.
- `.vercelignore` excludes local credentials, fixtures, tests, mobile backups and validation reports from the deployment upload.

## Square safety

The runtime still uses `NODE_ENV=production`. Square is permitted only with an explicit Sandbox opt-in, Vercel Preview identity, the exact project and branch, the approved staging database URL, Sandbox application prefix, and the exact staging callback/webhook URLs. Production deployment identity always fails. Local development/test behavior is retained; mock payments remain unavailable in optimized builds.

OAuth, webhook processing, Terminal and payment routes obtain their Square account service through this guard. Square HTTP remains pinned to `connect.squareupsandbox.com`. No production provider path is added.

The exact `/api/payments/webhooks/square` route is exempt from user-session middleware because it verifies Square's raw-body signature. Adjacent routes remain protected. Only the dedicated staging alias may receive a Vercel protection exception; project-wide protection remains unchanged.

## Owner Square configuration

After the alias is verified live, update the existing Sandbox application:

- OAuth redirect: `https://trading-docks-pos-staging.vercel.app/api/pos/payments/square/callback`
- Webhook notification: `https://trading-docks-pos-staging.vercel.app/api/payments/webhooks/square`

Edit the existing webhook subscription, preserving its signature key. OAuth consent remains an owner action. Do not substitute production credentials.

## Disable and rollback

Set the branch-only `POS_SQUARE_SANDBOX_ENABLED` to `false` and explicitly redeploy Preview to disable Square. Existing deployments retain old environment snapshots: remove the staging alias protection exception immediately if public access must stop. Preserve financial history and encrypted credentials. Restore the staging alias to a previously verified Preview deployment only; do not promote or roll back production.

## Validation

Baseline: TypeScript pass, 947 tests pass, lint zero errors with 534 existing warnings. Updated: TypeScript pass, 949 tests pass, focused lint pass; both database ledgers pass 126 groups including Square/Terminal emulation, failure recovery, 100-sale reconciliation and 500-line carts. These are engineering checks, not real Square acceptance.

Remote optimized build passed. Mobile: 580 tests and TypeScript pass. Both the synthetic owner and separately provisioned owner passed deployed browser checks: hosted Auth, desktop/mobile Square settings, one-time OAuth state creation, emulated denial and replay rejection, unsigned public webhook 403, anonymous API denial, manager administration denial, and mock payments disabled. Mobile verification reloads at the target width so screenshots are captured after the responsive layout settles.

The exact owner email was absent from staging Auth before creation. The new account owns a separate Sandbox workspace, one register and five sample inventory items (20 each); its temporary password is stored only in an ignored local handoff file. No email was sent and no production account was modified.

An older synthetic staging Auth record (`codex-staging-selling@example.invalid`) caused admin user listing to return HTTP 500 due to null token fields. Only its four null string fields were normalized to empty strings; admin listing then returned all nine users successfully. No password, permissions, schema or financial records were changed by this repair.

Production environment records (IDs, scope, types and update timestamps), active deployment `dpl_6v78T1Yrpzoc8UAsafBFbdgkkmd1`, and project-wide protection were verified unchanged. Error-level runtime logs for the new Preview returned zero entries during testing.

Initial build attempts exposed upload exclusions for shared mobile modules, nested `src/lib/supabase`, and Playwright configuration imports. Root-anchored exclusions and omission of test configuration resolved them; the final deployment is READY.

See `pos-vercel-staging-smoke.json`, `pos-vercel-owner-smoke.json` and the external acceptance report. Real OAuth consent/token exchange, authentic Square webhook delivery and Sandbox transactions remain PENDING; no successful Square transaction is claimed.
