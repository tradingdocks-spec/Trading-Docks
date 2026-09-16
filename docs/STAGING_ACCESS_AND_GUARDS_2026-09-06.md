# Staging continuation: access and guards

**Partially Implemented. Staging remains blocked; both P0s remain OPEN.**

After the user reported newly authenticated access, Vercel CLI authentication succeeded. Supabase management tools are still absent from the tools available to this task; no local Supabase token/environment credential was found. Opening the Supabase dashboard in the available in-app browser redirected to **Sign in**. The tab was retained for user authentication. This is an observed access mismatch, not a request to authorize staging again.

No Supabase project was created. No Vercel variables, migrations, customer records, or deployment settings were changed. No production database requests or deployments occurred. There is consequently no new staging project reference or staging URL to report.

## Guard implementation

- `tests/helpers/staging-guard.ts` adds fail-closed configuration validation with no production override.
- `playwright.config.ts` invokes the guard before starting any test whenever a custom target or QA credentials are supplied. Default synthetic public smoke tests remain available. Authenticated local runs are deliberately blocked until an explicitly supported local verification path is implemented.
- The guard requires `APP_ENV=staging`, rejects production deployment identifiers and the known shared production project, validates the Supabase origin against a staging project reference, and matches the app origin exactly to the verified Preview origin.
- The database helper rejects mismatched direct/pooler project identities and connection-string parameters that could redirect a connection. It does not echo supplied connection strings or secrets in errors. Future remote SQL runners must call it before constructing a connection.
- The ignored `.local-fixtures/staging-target.json` manifest must contain `projectRef` and `previewOrigin` populated **only after provider-side verification** of the newly isolated project and candidate Preview deployment. No manifest was created and no target was allowlisted in this pass. Without it, custom Playwright targets fail before test execution.
- Audit of executable `.launch-audit` reproduction scripts found isolated PGlite/mock fixtures, not remote database clients. Those scripts cannot certify staging and were not relabeled as remote evidence.

Limit: configuration validation cannot prove that a deployed backend actually uses the expected database or prevent later provider configuration drift. Provider metadata and actual server/database identity still require verification before remote testing. The database helper is prepared for a future remote runner; no remote runner exists or ran in this pass. This is not a completed staging safety certification.

## Validation

| Check | Result |
| --- | --- |
| Complete web suite before guard | PASS |
| Complete web suite after guard | PASS: 588 tests, 0 failed, 0 skipped |
| Five new guard regression tests | PASS: matching config, production/missing config rejection, deceptive origin rejection, foreign database rejection/secret-safe errors, default synthetic smoke |
| Actual Playwright CLI with unverified remote target | Correctly refused before tests started |
| Typecheck | PASS |
| Focused lint for guard/config/tests | PASS |
| Root lint | FAIL: 21 errors, 471 warnings |
| Production build (local only) | PASS |
| Both P0 reproductions | PASS locally: `reproduced: false` in isolated PGlite |
| Historical report fixture validation | PASS locally; not production reconciliation |
| Mobile suite | Not repeated: no mobile/shared application code changed in this pass |
| Staging migrations/preflight/backup | NOT RUN |
| Staging authenticated P0 matrix/database/concurrency | NOT RUN |

Root lint errors remain in `mobile/components/scanner/automatic-scanner-screen.tsx` (17 `react-hooks/refs` errors across lines 2553–2562), `mobile/components/scanner/prebuilt-scanner-bakeoff-screen.native.tsx` (`no-require-imports` line 144, `preserve-manual-memoization` line 419, `prefer-as-const` line 1043), and `mobile/services/mobile-deck-vault.ts` (`no-assign-module-variable` line 226). Full machine-readable results are in `.launch-audit/staging/lint.json`. No tests were weakened or suppressed and no unrelated lint repairs were made.

## Remaining work

Authenticate Supabase in the retained tab or expose the authenticated management connection to this task, then follow [the owner setup mapping](STAGING_OWNER_SETUP_2026-09-06.md) and [the staging scenario matrix](P0_STAGING_VERIFICATION_2026-09-06.md). The earlier owner handoff's pending guard status is superseded by this partial implementation, not by a completed environment certification.

Staging isolation: **NO**. Preview mapped to staging: **NO**. Migration/preflight/authenticated scenarios/direct state verification: **NO (not run)**. Staging concurrency: **NO (not run)**. Fulfillment P0: **OPEN**. CSV P0: **OPEN**. Production history, auth, tenant isolation, billing, root lint, and remaining certification gates remain open. Trading Docks remains **NO-GO**.
