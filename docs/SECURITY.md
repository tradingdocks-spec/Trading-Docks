# Security

## Implemented Controls

- Implemented: Global security headers in `next.config.ts`, including CSP, HSTS, frame denial, MIME sniffing protection, referrer policy, and permissions policy.
- Implemented: Production canonical host redirect in the request proxy.
- Implemented: Dashboard and onboarding authentication redirects.
- Implemented: API requests over 5 MiB are rejected at the proxy.
- Implemented: API responses receive `Cache-Control: no-store`.
- Implemented: Public share routes receive stricter cache, robot, and referrer headers.
- Implemented: Supabase service-role key is accessed only through server-side admin helper code.
- Implemented: Active web platform administration is authorized from `user_roles`, not from a hard-coded email address.
- Implemented: Server routes remain authoritative for web admin pages and privileged admin API actions; mobile access state is UX context only.
- Implemented: Platform role does not imply paid membership entitlement; owner/admin/support/analyst roles gain platform authority separately from product access.
- Implemented: Admin membership overrides are explicit product-entitlement overrides, separate from platform role and Stripe billing state.
- Implemented: Collector mutation security proposal `supabase/migrations/202608050001_collector_mutation_security_proposal.sql` adds database-layer ownership checks and a transactional Free-plan 500 total-card quantity cap for direct mobile writes, web writes, and offline replay. It has not been applied to production.
- Implemented: Mobile scanner foundation does not retain card photos by default and does not upload captured images without a clear user scan action. `expo-camera` supports local still capture, and iOS captured-still OCR now runs locally through Apple Vision without uploading images.
- Implemented: Mobile scanner replay refuses to process queued scan adds unless the authenticated session user matches the queue entry owner.
- Implemented: Scanner replay diagnostic logging records trigger and failure message only; it does not log passwords, auth tokens, Supabase keys, or captured card images.
- Implemented: Queued scanner adds remain in user-scoped local storage across sign-out and are not surfaced to a different signed-in account.
- Implemented: Scanner camera permission copy states that photos are used for card scanning and are not retained by default.
- Implemented: Scanner frame contracts require explicit `uploadedWithConsent` and `retainedByUser` flags, both false by default.
- Implemented: Magic recognition uses Scryfall metadata queries and explainable local scoring; captured images are not uploaded to Scryfall or any cloud vision provider by default.
- Implemented: Magic scanner benchmark reports omit source image paths, image filenames, and image contents. Private fixture and benchmark output directories are ignored by Git.
- Implemented: The scanner benchmark builder is gated by `EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER=true`, is not linked from normal navigation, stores only local ignored fixture paths, and does not upload images or write production analytics.
- Implemented: Multi-TCG unsupported-card observations store detection evidence and confidence, not captured image payloads.
- Implemented: Continuous scanner sessions persist scanner results and offer fields by user id without storing captured images or sending email/export automatically.
- Implemented: Live-frame analysis accepts transient in-memory luminance samples and returns bounds, quality metrics, guidance, and image fingerprints without exporting or retaining source images.
- Implemented: Native scanner diagnostics are development-only, report geometry/state/quality metadata only, and do not log or export source images.
- Implemented: Local guide calibration preferences are stored by user id in app storage and are not production configuration.
- Partially Implemented: VisionCamera/Nitro dependencies are installed for a custom Expo development build, but physical-device cleanup and native frame-buffer handling still need QA before production claims.
- Planned: Before remote OCR, artwork matching, foil analysis, or analytics for continuous scanning, add explicit consent, retention controls, and image-free logging guarantees.
- Implemented: Native Magic OCR v1 deletes temporary captured stills after Apple Vision processing and reports cleanup status without displaying source image paths.
- Implemented: The mobile release privacy audit is captured in `docs/MOBILE_PRIVACY_RELEASE_AUDIT.md`; no source card images are retained by default, and scanner benchmark/camera diagnostics remain development-gated.
- Implemented: Mobile production release config blocks public service-role/secret-shaped `EXPO_PUBLIC_*` values, gates diagnostics/showcases behind non-production development flags, and exposes support/legal links from a typed release config.
- Implemented: Mobile root route errors render generic recovery copy and do not display raw exception details to production users.
- Partially Implemented: Mobile account deletion is support-assisted through a visible request path. Backend self-service deletion remains Planned and must be approved before claiming fully automated deletion compliance.
- Implemented: Marketplace credential migrations attempt to restrict encrypted payload columns.
- Implemented: Public share migrations revoke anonymous privileges from private tables.

## Requires Production Configuration

- Supabase secrets, RLS policies, email auth settings, OAuth provider callbacks, storage buckets, and migrations.
- Stripe secret key, publishable key, price IDs, webhook signing secret, and portal settings.
- Vercel environment variables, deployment protection, canonical domain, and log access controls.
- Cloudflare inbound email routing and webhook authentication.
- Marketplace provider credentials and callback URLs.
- Resend transactional email settings if email delivery is used.

## Security Concerns

- Partially Implemented: Public API allowlist includes market/image/search endpoints that may need durable rate limiting.
- Partially Implemented: Some provider callback and webhook routes are proxy-exempt and must rely on route-local verification.
- Partially Implemented: Repeated migrations and root SQL snippets increase risk of staging/production drift.
- Partially Implemented: Legacy migrations still contain `is_platform_owner()` and email-based policies. Active code no longer depends on them for admin route authorization, but production schema should be migrated to role-based policies in a dedicated database task.
- Partially Implemented: Legacy membership schema constraints still allow/persist `business`; active code now emits canonical `store`, so a reviewed migration is required before production Store billing and overrides can be relied on.
- Partially Implemented: A tracked `.env.local` file exists in the working tree listing local configuration; do not add secrets and verify ignore rules before commits.
- Planned: Add automated cross-account data isolation tests.
- Planned: Replay the Collector mutation security proposal in staging and run `supabase/verification/verify_collector_mutation_security.sql` before production approval.
- Planned: Add observability with secret and PII scrubbing.
- Planned: Before enabling OCR/image-recognition uploads, add explicit consent copy, retention controls, provider logging review, and tests proving photos are not stored by default.
- Planned: If scanner replay moves to a server RPC, add an auditable server-side idempotency ledger and structured logging that redacts card payloads where required.
- Planned: Remote scanner providers must use HTTPS-only communication and sanitized telemetry that excludes images, tokens, service-role keys, and private user data.
- Implemented: Native OCR is an iOS development-build feature, not an Expo Go feature; Android/web return explicit unsupported states.
- Planned: Before collecting shared scanner fixtures, confirm copyright permission, storage location, retention window, and access controls with the product owner.
- Planned: Pokemon, One Piece, and Lorcana catalog providers require licensing/API review before mobile or server integration; the mobile client must not scrape publisher pages directly.
- Planned: Before mobile paid subscriptions ship, backend subscription/entitlement state must remain authoritative and native purchase receipts must be reconciled through an approved StoreKit/Google Play Billing architecture.
- Planned: Complete App Privacy and Play Data Safety disclosures from the mobile privacy matrix before external release.

## Access Fallbacks

- Failed role lookup: treat as normal user and deny privileged operations.
- Missing profile/account type: default to Free/collector-safe workspace behavior.
- Missing membership: default to Free entitlements.
- Unknown membership tier: default to Free entitlements; legacy `business` normalizes to Store only for compatibility.
- Stale billing data: past-due access is honored only while the current period is still in the future; otherwise Free fallback is used.
- Suspended account: deny entitlements and Command Center access.
- Admin role with normal subscription: keep normal subscription entitlements and add only admin Command Center authority.

## Collector Mutation Security Audit

- Current ownership enforcement: Implemented through RLS policies on `inventory_items`, `inventory_locations`, `binder_card_trade_status`, and `collector_wishlist` comparing `auth.uid()` to `user_id`.
- Current insert/update/delete policies: `inventory_items` currently grants authenticated users `select`, `insert`, `update`, and `delete` with owner-only RLS. It does not currently enforce membership limits in the database.
- Quantity representation: `inventory_items.quantity` is an integer with `check (quantity >= 0)`. Quantity zero remains a row with zero owned copies.
- Limit interpretation: Free means 500 total owned card quantity, not 500 unique ownership records.
- Current authoritative membership source: active web code resolves membership from explicit `admin_membership_overrides`, current `billing_subscriptions`, and Free fallback; `user_roles` remains platform authority only.
- Race condition risk: current client/API checks can be bypassed by simultaneous direct writes or offline replay. The proposal serializes per-user inventory mutations with `pg_advisory_xact_lock`.
- Offline replay risk: queued mobile writes can replay after membership or ownership state changes. The mobile replay path now classifies proposed database error codes and retains failed queued writes with error metadata.
- Workspace/store behavior: active inventory is user-owned. Store/shared workspace inventory is not represented by active inventory fields and requires a later schema design.
- Service-role behavior: active service-role inventory access found in this audit is read-oriented. Direct service-role inventory writes without a user JWT should be rejected by the proposed trigger because `auth.uid()` is null; future service imports need an auditable authenticated-user or reviewed server pathway.

## Staging Validation Instructions

- Requires Production Configuration: Local replay was unavailable in this Codex environment because `supabase`, `psql`, and Docker were not installed.
- Use a disposable Supabase project or local instance only; do not point these scripts at production.
- Replay the full migration chain from `supabase/migrations` in timestamp/name order, then apply `supabase/migrations/202608050001_collector_mutation_security_proposal.sql`.
- Run `supabase/verification/verify_collector_mutation_security.sql`; then run a two-session concurrency check where both sessions try to increase the same Free user's total above 500 and confirm one raises `TD_COLLECTOR_FREE_LIMIT_EXCEEDED`.
- Confirm the structured error message, `DETAIL` JSON, and hint remain stable for mobile/web clients: `TD_COLLECTOR_UNAUTHORIZED`, `TD_COLLECTOR_FREE_LIMIT_EXCEEDED`, `TD_COLLECTOR_INVALID_QUANTITY`, and `TD_COLLECTOR_MISSING_MEMBERSHIP`.
- Confirm rollback in the disposable database by disabling `enforce_collector_inventory_mutation_insert`, `enforce_collector_inventory_mutation_update`, and `enforce_collector_inventory_mutation_delete`, then revoking `collector_mutate_inventory_item(jsonb)`.

## Rollout And Rollback

- Staging rollout: replay migrations into disposable staging, apply the proposal, run the verification SQL, test mobile direct writes and web API writes for Free/Collector/Seller/Store users, then inspect structured errors in Supabase client responses.
- Production approval gates: product owner must approve total-quantity limit interpretation, engineering must approve service-role/import impact, and database owner must approve applying the trigger/RPC migration.
- Rollback plan: disable the three proposed `enforce_collector_inventory_mutation_*` triggers first, revoke the proposed RPC if needed, then drop proposal functions only after confirming no deployed client depends on them. Do not rewrite historical migrations.
