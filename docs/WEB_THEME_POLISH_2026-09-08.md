# Website theme and polish — September 8, 2026

> Palette superseded by the logo-blue refinement on September 9. See `HOMEPAGE_BRAND_REFINEMENT_2026-09-09.md`. This report records the earlier mint/teal iteration.

Status: **Implemented locally; not deployed.**

Trading Docks now uses one semantic palette throughout the web app, with explicit Light, Dark, and System choices. The palette preserves the charcoal brand direction and introduces warm white surfaces with deep teal actions in light mode.

## Palette

| Role | Dark | Light |
| --- | --- | --- |
| Page | `#101314` | `#F5F6F2` |
| Surface | `#1A2021` | `#FFFFFF` |
| Raised surface | `#222A2B` | `#E8EEE8` |
| Main text | `#EDF2F1` | `#1D302B` |
| Secondary text | `#BECAC8` | `#405B51` |
| Muted text | `#94A5A2` | `#556B62` |
| Primary action | `#92DFD4` | `#176C5B` |
| Text on action | `#102C27` | `#FFFFFF` |

`src/app/theme.css` is the palette source. Tailwind semantic utilities and CSS variables share these values. Status colors retain their meaning, with different light/dark values for readable success, warning, and error states.

## Implemented

- Application-wide theme provider with system preference, persistent selection, and cross-tab synchronization. Uses the existing `next-themes` dependency.
- Accessible named theme selector in the public header and dashboard topbar, with a compact control on authentication and other standalone routes. The control remains disabled until hydrated. The pricing-cycle and password-reveal controls use the same readiness guard to avoid accepting clicks before their handlers are available.
- Broad migration of more than 180 UI files: page surfaces, panels, navigation, forms, charts, tables, dialogs, badges, empty states, landing sections, and shared dashboard components.
- Coordinated light/dark borders, shadows, accent treatments, native inputs, selection colors, and keyboard focus indicators. Strong panels and dashboard dialogs use opaque surfaces so underlying text does not show through.
- Improved tiny web labels, disabled shared-button states, and reduced-motion handling.
- Theme-aware footer branding and fixed Google-button label contrast.
- Sign-in layout now grows and scrolls naturally instead of clipping content inside a fixed desktop viewport. Its chart uses the shared accent palette.
- Generated showcase/social images retain their fixed canvas palettes. Printed labels retain paper colors. Card art, mana colors, and third-party brand marks retain their identity.

## Coverage and limits

The source audit covered the web app's 68 page routes and shared UI. Runtime theme checks cover nine public routes: home, pricing, sign-in, sign-up, forgot-password, update-password, privacy, terms, and security. Browser projects cover Chromium, Firefox, and WebKit at desktop, tablet, and mobile sizes.

Shared dashboard metric cards and page headers were also rendered in an isolated local fixture, alongside representative table, form, status, button, and dialog treatments. These screenshots use example data and are **not** authenticated dashboard screenshots.

**Partially verified:** signed-in, role-specific dashboards and live business workflows. QA credentials were not available; authenticated browser tests remain skipped. No claim is made that every data-dependent state has been visually certified.

No production settings, Supabase schemas, authentication behavior, or deployment configuration were changed by this theme work. The checkout contains concurrent unrelated work; it was preserved.

## Validation

- TypeScript: passed.
- Unit tests: 601 passed, including the new palette contrast checks.
- Production build: passed through the Playwright production-server setup.
- Web-source ESLint: 0 errors; 405 warnings remain.
- Repository-wide lint: remains blocked by 21 mobile errors observed in the baseline and final root-lint run. Mobile runtime was not changed by this task.
- Full browser suite: **150 passed, 34 skipped, 0 failed** (`.launch-audit/theme-final-acceptance-e2e.log`). Skips include unavailable authenticated QA and tests intentionally limited to selected browser/viewport projects.
- Final opaque-panel adjustment: production rebuild and focused theme/visual regression run passed (5 passed, 1 conditional skip).
- Focused final-control lint: passed with no warnings or errors.
- Final public screenshots: 24 route/theme/width combinations, plus ten homepage viewport captures and eight isolated component/dialog captures. No document overflow was found in the 34 measured public-page captures.

Browser validation uses the local production build and temporary loopback HTTPS test server; it does not exercise production credentials or mutate production data.

## Review artifacts

- `.launch-audit/theme-review.html` — selectable light/dark screenshot gallery.
- `.launch-audit/theme-review-results.json` — public route screenshot measurements.
- `.launch-audit/theme-home-widths.json` — homepage responsive measurements.
- `.launch-audit/theme-workspace-{dark,light}-{1440,390}.png` — isolated shared-component previews.
- `.launch-audit/theme-dialog-{dark,light}-{1440,390}.png` — example dialog previews.
- `tests/theme-tokens.test.ts` — core text/action/status token contrast checks and token integrity.
- `tests/e2e/theme.spec.ts` — rendering, native input styling, persistence, system preference, cross-tab behavior, overflow, and sign-in clipping checks.

The token contrast checks cover explicit opaque token pairs; they are not a full WCAG certification of every composited or data-dependent UI state.
