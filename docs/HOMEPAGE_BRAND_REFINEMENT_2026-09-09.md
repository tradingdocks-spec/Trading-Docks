# Homepage brand refinement — September 9, 2026

Status: **Implemented locally; not deployed.**

The previous mint/teal palette diluted the blue/cyan logo. This refinement restores the logo's color family and gives the homepage more visual depth while retaining Light, Dark, and System modes.

## Design changes

- Dark mode: ink-blue canvas `#0A101B`, blue surfaces `#121E30`, cyan actions `#35CAFA`.
- Light mode: cool white canvas `#F3F7FD`, white surfaces, electric-blue actions `#0065D9`.
- Shared semantic tokens propagate the brand correction throughout the website.
- Homepage: cyan-to-blue headline, blue gradient calls to action, soft directional color fields, and a restrained grid behind the hero.
- Layered card frames surround the interactive product demo. The card identity tile, selected lifecycle stage, and key value have stronger visual emphasis.
- The seven-step lifecycle now uses illustrated tiles, alternating blue/cyan surfaces, and subtle hover movement.
- Storage and buying previews have stronger framing; the cost breakdown uses distinct blue/cyan segments; trust panels and the closing section provide more visual variety down the page.
- Decorative layers remain behind content. Mobile layouts and reduced-motion preferences are preserved. The demo remains explicitly illustrative.

## Validation

- Baseline and final TypeScript: passed.
- Baseline and final unit tests: 601 passed.
- Core semantic text/action/status pairs: contrast tests passed in both themes.
- Changed TypeScript/TSX source ESLint: passed.
- Production build: passed.
- Full browser suite: 150 passed, 34 conditional/credential-dependent skips, 0 failures. Intentional visual baselines refreshed and reviewed.
- Public page gallery: 24 theme/route/width captures with no document overflow.
- Homepage previews captured at 1728, 1440, 1024, 768, and 390 pixels in both themes with no document overflow.

The authenticated dashboard caveat from the previous report still applies: theme tokens are applied throughout the source, but role-specific live workflows need a signed-in QA session. Existing unrelated mobile lint issues are outside this change.

## Review

Open `.launch-audit/brand-review.html` to compare public pages and shared component fixtures. Workspace/dialog images contain example data, not a live account. Updated visual snapshots reflect the intentional palette and homepage design change.

No deployment, database, environment, or authentication-backend changes were made.
