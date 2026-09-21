# POS isolated staging deployment

Status: **Partially Implemented — deployment and external acceptance in progress**.

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

Remote deployment, public endpoint behavior, authenticated browser QA and real Square acceptance are recorded separately in the external acceptance report.
