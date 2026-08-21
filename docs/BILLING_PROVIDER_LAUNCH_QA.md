# Billing Provider Launch QA

Status labels:

- Complete: verified by automated tests or source review in this branch.
- Needs QA: requires deployed Preview/Production, RevenueCat dashboard access, sandbox purchase tooling, or representative accounts.
- Blocked: cannot be proven safely from local source alone.

## Canonical Authority

Trading Docks keeps commercial billing separate from platform authority.

| Concept | Authority | Notes |
| --- | --- | --- |
| Auth identity | Supabase Auth user UUID | The same UUID must be used as RevenueCat `app_user_id` on web and mobile. |
| Platform role | `user_roles` | Owner/Admin access is trusted only from server/database role resolution. |
| Workspace role | `workspace_members` | Controls workspace-scoped operational actions. |
| Provider subscription | `billing_provider_subscriptions` | Apple/Google RevenueCat state is the active provider authority for effective commercial access. |
| Manual membership override | `admin_membership_overrides` | Explicit admin/support action; separate from platform role and billing plan. |
| Canonical display row | `billing_subscriptions` | Updated by reconciliation for compatibility/display, but not allowed to override active RevenueCat provider state. |

Implemented in this checkpoint:

- Complete: `src/lib/platform/billing-access-resolution.ts` centralizes provider/manual/legacy fallback resolution.
- Complete: web server access and mobile account snapshots both consume that resolver.
- Complete: expired RevenueCat provider rows beat stale legacy `billing_subscriptions` paid rows, preventing accidental paid access after cancellation/expiration.
- Complete: legacy `billing_subscriptions` rows remain a compatibility fallback only when no RevenueCat provider row or manual override exists.
- Complete: stale RevenueCat webhook events with an older `current_period_end` cannot overwrite a newer provider-subscription state.

## Provider Status Matrix

| Provider status | Effective access behavior | Status |
| --- | --- | --- |
| `active` | Grants mapped Collector/Seller/Store entitlement. | Complete |
| `trialing` | Grants mapped entitlement. | Complete |
| `past_due` with future period end | Keeps mapped entitlement through paid/grace period and marks billing status `past_due`. | Complete |
| `past_due` after period end | Falls back to Free unless manual override exists. | Complete |
| `canceled` with future period end | Keeps mapped entitlement through paid period. | Complete |
| `canceled` after period end | Falls back to Free unless manual override exists. | Complete |
| `unpaid` | Does not grant paid access. | Complete |
| `incomplete` | Does not grant paid access. | Complete |
| `incomplete_expired` | Does not grant paid access. | Complete |
| `paused` | Does not grant paid access. | Complete |
| stale older webhook event | Does not overwrite a newer provider period. | Complete |

## Plan/Role States To Validate

| Account state | Expected effective access | Automated status | Manual QA |
| --- | --- | --- | --- |
| Free user, no provider rows | Free features only. | Complete via entitlement tests. | Needs QA in deployed browser. |
| Collector active provider | Collector features, no Seller/Store features. | Complete via resolver/catalog tests. | Needs sandbox purchase/restore QA. |
| Seller active provider | Seller features, no Store-only features. | Complete via resolver/catalog tests. | Needs sandbox purchase/restore QA. |
| Store active provider | Store features. | Complete via resolver/catalog tests. | Needs sandbox purchase/restore QA. |
| Owner/Admin with Free billing | Full platform capabilities, billing display remains truthful. | Covered by platform authority tests from prior checkpoint. | Needs deployed Owner/Admin browser QA. |
| Admin role without Owner/full-platform authority | Admin command capabilities only; does not imply paid commercial membership. | Covered by mobile/account tests. | Needs deployed browser QA. |
| Manual override | Override grants explicit commercial tier without faking provider billing. | Complete via resolver tests. | Needs admin action QA if used. |

## Checkout And Portal QA

Required deployed checks:

1. Sign in as a representative Free account.
2. Open `/dashboard/plans`.
3. Start Collector monthly checkout.
4. Confirm the RevenueCat web checkout receives the authenticated Supabase UUID as `app_user_id`.
5. Complete sandbox/test purchase.
6. Confirm `/api/webhooks/revenuecat` receives the event and writes:
   - `billing_provider_events`
   - `billing_provider_subscriptions`
   - compatibility `billing_subscriptions` row when no manual override exists.
7. Refresh `/dashboard` and `/dashboard/plans`; verify effective Collector features unlock.
8. Repeat for Seller and Store.
9. Open billing management/customer portal; verify clear error state if management env is missing and a valid redirect if configured.
10. Cancel a subscription; verify access remains through the paid period and falls to Free after expiration.

Blocked locally: this requires RevenueCat sandbox/web checkout and deployed environment variables.

## Webhook Security And Ordering QA

Automated coverage:

- Complete: exact and `Bearer` authorization header contracts are accepted.
- Complete: missing/wrong webhook authorization is rejected.
- Complete: `TEST` event returns safely without a real user.
- Complete: malformed events are rejected.
- Complete: invalid Supabase UUID app users are rejected before granting access.
- Complete: duplicate event IDs preserve idempotency.
- Complete: older provider-period updates do not overwrite newer provider state.

Required deployed checks:

1. Send unauthenticated POST to `/api/webhooks/revenuecat`; expect `401`.
2. Send RevenueCat `TEST` event with configured authorization header; expect `2xx`.
3. Confirm Vercel logs never print authorization secrets.
4. Confirm webhook failures surface safe, actionable server logs without exposing payload secrets.

## Failure And Provider Configuration QA

If RevenueCat web billing env vars are missing:

- Upgrade buttons must show a clear unavailable/configuration message.
- Users must not receive paid access.
- Server endpoints must return explicit configuration errors.

Required Vercel variables are documented in `docs/BETA_RELEASE_READINESS.md`.

Legacy Stripe environment variables should not be deleted automatically during this phase. Remove them only after RevenueCat web checkout and native purchase/restore are verified in production.

## Remaining Manual Gates

- Blocked: live RevenueCat checkout and customer portal are not validated from local source.
- Blocked: native iOS/Android purchase restore and RevenueCat login need physical/device build QA.
- Blocked: web/mobile same-UUID entitlement sharing needs at least one sandbox purchase account.
- Needs QA: Owner/Admin billing display should show commercial plan truth separately from full platform authority.
- Needs QA: representative Free/Collector/Seller/Store dashboards after provider transitions.
