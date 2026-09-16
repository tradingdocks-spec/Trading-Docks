# Homepage and pricing polish — September 6, 2026

**REVERTED September 7 at the user's request. Production now runs unchanged main commit `1db6144dc8b891de8d0721bc10a710c6a3ac6539`, deployment `dpl_AYJJ3GP8B4xiFDmU2TYqUDUUXDV5`. Homepage/pricing returned 200 with restored main content. PR #4 was closed without merging.**

Further website work must start from main and preserve its current design. A clean worktree at `../Trading-Docks-main-website`, branch `codex/main-website-fixes-20260907`, starts at `origin/main`. Prior audit, inventory, mobile, and rejected homepage changes were not copied into it. The deployment notes below are historical and superseded by this rollback.

## Deployment follow-up

The user subsequently requested deployment. A separate release worktree (`../Trading-Docks-homepage-release`) was based on the exact live revision `1db6144dc8b891de8d0721bc10a710c6a3ac6539`, retaining production's existing `.td-input` styles. Only the five runtime files listed below and the two matching source-contract test updates were committed as `7cde9b9` on `codex/deploy-homepage-pricing-20260906`. The unrelated local inventory P0/migration, mobile, dependency, and test-infrastructure changes were excluded.

- Live site: https://www.tradingdocks.com
- Promoted deployment: `dpl_6caZuqrDLUuFwCvcT39VYGevJZJG` (Vercel READY).
- Previous deployment retained for rollback: `dpl_AYJJ3GP8B4xiFDmU2TYqUDUUXDV5`.
- Release branch pushed; [draft PR #4](https://github.com/tradingdocks-spec/Trading-Docks/pull/4) remains unmerged. Do not let a later main-branch deployment unintentionally replace this release before its changes are incorporated.
- Isolated release validation: 628 unit tests passed, typecheck and focused ESLint passed, diff check passed, Vercel production build passed. This count differs from the original working checkout because the release preserves the live production base.
- Public post-promotion checks: homepage and pricing returned 200, expected content present, CSP/HSTS present. Browser checks confirmed annual pricing/links and changing the sample game.
- Candidate verification limitation: production's canonical-host rule redirected the unpromoted candidate to the current public domain; content and UI were therefore verified immediately after promotion. The rollback deployment was retained.
- Vercel CLI generated a deployment-protection bypass credential for candidate inspection using its normal authenticated workflow; no secret value was printed or committed. No Supabase credentials, schemas, migrations, or customer records were changed.

The remaining sections record the original local implementation/test pass. The full working checkout was **not** deployed. Inventory P0 and other production certification gates remain OPEN.

This pass prioritizes the public homepage and pricing, as requested. It preserves the existing page structure, prices, membership authority, and production security headers. No Supabase, Vercel, billing-provider, or production data changes were made.

## Changes

- The homepage market example now renders a clearly labeled illustrative sample on the first render. It contains fictional sample products and demo values, never current market quotes. All five game selectors and four ranking modes remain interactive. This public example no longer makes a provider request or gets stuck waiting for one; the live market API and dashboard remain separate and unchanged.
- Homepage paid-plan links explicitly carry `billing=monthly`; pricing-page monthly/annual selection continues into the signup form with the chosen plan and cycle. Prices still come from the canonical membership catalog. This does not repair or certify subsequent onboarding/checkout continuation.
- Store pricing and the homepage trust block consistently say employee accounts are not yet available. Removed employee seats/staff from those advertised active benefits and replaced internal implementation language in the pricing introduction/footer with user-facing explanations. Other feature claims still require the broader certification review.
- Improved market/pricing text contrast, exposed selected control states, added a public pricing main landmark, and made wide comparison tables keyboard-focusable with labels/captions. The pricing grid contains table scrolling within the comparison region.
- Restricted custom scrollbars to devices with a fine pointer and hover. Testing found the old global 10px scrollbar reduced mobile WebKit's visible viewport and clipped page width.
- Moved the global anchor reset into the base CSS layer so it no longer overrides button/link color utilities. This fixes white-on-cyan CTA text and allows the intended dark foreground; a browser assertion checks the rendered color.

## Browser test infrastructure

Local tests previously served HTTP while production CSP upgrades subresources to HTTPS. WebKit consequently failed to load styles/scripts, and the suite ignored SSL console errors and skipped several interactions. A loopback-only HTTPS proxy now serves the actual production build and retains CSP/HSTS. OpenSSL generates a short-lived local certificate under ignored `.local-fixtures/playwright-tls`; Playwright permits that self-signed certificate **only in its local fixture**, with no trust-store installation or production change. OpenSSL from an official installation is required (Git for Windows' bundled binary is supported).

The SSL-error exception and public WebKit interaction skips were removed. Remote/authenticated testing still requires the existing verified-staging guard. The new browser tests exercise sample rendering/provider independence, all game tabs, ranking, canonical prices, monthly/annual links, actual signup navigation, hidden intent values, and overflow across the configured browser/device projects.

Generated Playwright report/result directories were added to ESLint's generated-output ignores. Before this correction, report UI/vendor bundles inflated root lint to 278 errors and 6,660 warnings. No product source was excluded and no lint rule was relaxed.

## Final validation

| Check | Result |
| --- | --- |
| Complete web unit suite | PASS: 588 passed, 0 failed/skipped |
| Complete configured Playwright suite | PASS with existing scope/credential skips: 110 passed, 34 skipped, 0 failed |
| New homepage/pricing browser scenarios | PASS across all eight configured browser/viewport projects, including mobile WebKit |
| Typecheck | PASS |
| Production build | PASS locally as part of the final Playwright web-server startup |
| Focused lint | PASS |
| Root lint | FAIL: 21 existing mobile-source errors, 469 warnings |
| `git diff --check` | PASS |
| Mobile app suite | Not repeated: no mobile/shared application source changed |

The 34 browser skips comprise eight missing-credential dashboard checks, 21 screenshot tests intentionally assigned to other baseline projects, and five desktop/tablet cases where the mobile-only menu test does not apply. The eight previously skipped public WebKit interactions now run and pass. Authenticated account testing remains unavailable and is not implied by successful navigation to a signup form.

Homepage desktop/mobile screenshot baselines were refreshed after visual review for the sample, copy/contrast, and corrected mobile rendering. Screenshot thresholds were not changed. The final full suite then passed against those baselines. Current pricing was separately inspected in `.launch-audit/pricing-final-review.png`. Logs and generated diagnostic crops live in `.launch-audit/home-pricing-*` and related review artifacts.

## Scope and remaining gates

Runtime files changed: `src/components/landing/MarketSection.tsx`, `src/components/landing/PricingSection.tsx`, `src/components/landing/TrustSection.tsx`, `src/app/dashboard/plans/TieredPlanComparison.tsx`, and `src/app/globals.css`. The plans component is also used by the web dashboard; its copy/accessibility changes apply there without changing entitlement or purchase logic. No mobile application or shared membership code was edited.

Test/config changes: `eslint.config.mjs`, `playwright.config.ts`, `tests/helpers/local-https-server.mjs`, `tests/e2e/home-pricing.spec.ts`, `tests/e2e/helpers.ts`, `tests/e2e/public-smoke.spec.ts`, `tests/e2e/visual-regression.spec.ts`, `tests/public-web-ui.test.ts`, and `tests/membership-entitlements.test.ts`, plus the two homepage PNG baselines under `tests/e2e/visual-regression.spec.ts-snapshots`. Existing literal-copy/source-contract expectations were updated for the intended behavior; new browser assertions verify the user-visible result. No assertion thresholds were relaxed.

The existing dirty checkout, including prior P0 remediation and mobile work, was preserved. Generated build/typecheck artifacts may remain in the working tree. The inventory P0 migrations remain unapplied and both production P0 blockers remain OPEN. Authentication, tenant isolation, paid signup/checkout continuation, billing lifecycle, production history/recovery, lint, and final launch certification remain open. Browser emulation is not physical Safari/iOS certification.
