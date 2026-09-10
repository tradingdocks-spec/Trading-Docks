# Homepage lifecycle redesign — 2026-09-08

Status: Implemented locally on `codex/homepage-lifecycle-design`. Not deployed. This is a public homepage redesign, not certification of the underlying product or the open production launch gates.

## Audit and direction

Reviewed the live [Trading Docks homepage](https://www.tradingdocks.com), the current landing components, membership catalog, inventory storage UI, product documentation, and rendered screenshots at 1728, 1440, 1024, 768, and 390 pixels before runtime edits.

The existing positioning and dark design were worth preserving. The main conversion problem was hierarchy: the hero presented four explanatory rows before the primary CTA, while its visual showed seller metrics and navigation instead of a card moving through the system. On mobile, that explanation delayed the signup action further. Low-contrast secondary text, a large header mark, and dense operating terminology made the page feel less approachable than the product premise.

The page repeated the lifecycle in Hero, Experience, Workflow, and Plan Journey; repeated authority/operations claims in Features, Ecosystem, Automation, Trust, and product-principle testimonials; and described plan progression twice before showing pricing. The live mobile document measured 20,130 pixels; desktop at 1440 measured 9,246 pixels. Desktop pricing squeezed four plans beside a large intro column. These patterns increased reading effort without equivalent proof.

There was no verified customer evidence to justify adding testimonials, logos, adoption numbers, or performance claims. The redesign uses concrete product demonstrations and links to existing security information for credibility. Signup intent should improve through clearer positioning, earlier access, and a specific free allowance; an actual conversion lift requires measurement after release and is not claimed here.

## New narrative

1. What it is: the operating system for trading cards. Preserve “Follow every card from scan to sale.” Explain identity, value, and location in familiar language.
2. Why care: one card record, with six interactive stages. Signup appears immediately under the support copy, alongside a secondary “See how it works” link.
3. How it works: a concise seven-stage lifecycle, including acquisition.
4. What makes it different: physical storage/Chaos Sort and Deal Desk are shown as product examples instead of generic benefit tiles.
5. Decision support: retain the provider-independent market demonstration with all game/ranking controls.
6. Fit and trust: name collectors, sellers, and stores; explain review, source context, and account ownership without claiming third-party certification.
7. Cost: four existing plans across the full content width, with detailed comparison disclosed on demand and a link to the full pricing route.
8. Start: repeat the free-account action with the 500-card/5-deck allowance.

## What remained, moved, or was consolidated

| Existing material | Decision |
| --- | --- |
| Core headline, brand assets, dark palette | Preserved; charcoal surfaces and restrained mint accent |
| Hero metrics and workspace navigation | Replaced with one interactive card record |
| Trusted Games / workspace persona blocks | Condensed to a collector, seller, and store audience strip; removed broad game-support badges |
| Experience / Workflow | Consolidated into one lifecycle section and the hero demonstration |
| Plan Journey | Removed from homepage; progression explained at pricing |
| Features / Ecosystem / Automation | Consolidated into storage, acquisition, and market product examples; technical provider-authority table removed from public narrative |
| Trust / product-principle testimonials | Replaced by three specific trust principles and existing security link; no invented social proof |
| Market | Retained its sample data, controls, and dashboard route; given full width |
| Pricing | Canonical monthly/annual amounts and paid signup intent preserved; comparison expandable |
| Final CTA | Shortened and aligned with the free-account goal |
| Footer | Existing navigation, privacy, terms, security, and publisher/value disclosures preserved; compact mobile columns |

Unused legacy landing components remain on disk to avoid unrelated deletions. The homepage no longer mounts them or the former background/reveal effects.

## Product honesty and scope

The new interactive record is an illustrative marketing composition based on existing product concepts, not a literal screenshot or live account. It displays example identity, cost, storage, listing export, fulfillment, and net-sale values. The printing reference is Double Masters Lightning Greaves #267; [reference](https://mtg.wtf/card/2xm/267/Lightning-Greaves). Prices, order ID, storage addresses, and acquisition totals are invented examples, not market quotes. Sale arithmetic is explicit: $28 − $18 − $4.50 = $5.50. The acquisition example is $420 − $252 − $63 = $105.

Listing copy describes CSV preparation and makes channel/account configuration conditional. No new integration is promised. Store employee accounts remain explicitly unavailable in pricing. No authentication, pricing authority, payment, provider, schema, production data, secret, environment file, or deployment setting was changed. The existing defensive authenticated-home redirect remains intact. Mobile application files were not edited.

## Visual review and iteration

Pass one established the shortened narrative and product compositions. Rendered review found the mobile header lost its wordmark, secondary product text needed to be larger, and mobile pricing/footer spacing could shrink further. Pass two corrected those items, aligned desktop navigation to the content, raised product text sizes, added reduced-motion handling and visible focus, and made mobile-menu Escape/focus/resize behavior work. The tablet view keeps acquisition and storage compositions legible without forcing a desktop dashboard into the viewport.

Screenshots use actual browser rendering. Horizontal scrolling is confined to labeled market and expanded pricing table regions; the document itself has no horizontal overflow. The existing market table keeps its columns rather than hiding prices or source information on mobile. Browser emulation does not constitute physical-device certification.

## Screenshots

Full rendered captures, before from the live site and after from the local production build:

| Width | Before | After |
| --- | --- | --- |
| 1728 | [Before](../.launch-audit/homepage-before-1728.png) | [After](../.launch-audit/homepage-after-1728.png) |
| 1440 | [Before](../.launch-audit/homepage-before-1440.png) | [After](../.launch-audit/homepage-after-1440.png) |
| 1024 | [Before](../.launch-audit/homepage-before-1024.png) | [After](../.launch-audit/homepage-after-1024.png) |
| 768 | [Before](../.launch-audit/homepage-before-768.png) | [After](../.launch-audit/homepage-after-768.png) |
| 390 | [Before](../.launch-audit/homepage-before-390.png) | [After](../.launch-audit/homepage-after-390.png) |

The before and after builds differ because the checkout already included previous unpublished/prior-branch fixes; screenshots compare the observed live experience against this local result, not an isolated attribution experiment. Audit artifacts are local files in `.launch-audit`.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | PASS: `npm run typecheck` |
| Unit tests | PASS: 588 tests, zero failed/skipped |
| Production build | PASS, including the final Playwright server build |
| Complete browser suite | PASS: 126 passed, 34 skipped, zero failed |
| Changed-file lint | PASS |
| Root lint | Existing failure: 21 mobile errors and 469 warnings, same as baseline |
| Diff whitespace checks | PASS for this change |
| Expo Web / Native | Not run; active mobile app unchanged |

The 34 browser skips are eight credential-gated dashboard checks, 21 screenshot cases assigned to other baseline projects, and five mobile-only menu cases outside mobile projects. No new test skips or threshold relaxations were added. Homepage screenshot baselines were refreshed after visual review; the full suite subsequently passed. The new interaction tests verify all six stages, persistent card identity, sample disclosure, keyboard activation, no API writes, expandable pricing, free signup navigation, Escape/focus restoration, and resizing with an open menu. Existing browser tests retain game/ranking controls, paid billing intent, public routes, legal routes, and mobile WebKit checks.

During regression, corrected a WebKit menu breakpoint interaction by retaining the established 1280px desktop-menu threshold. Updated test selectors to scope the repeated Start free label to the header and to recognize the existing signup behavior: an empty paid-plan field represents free signup. Authentication implementation was not changed.

| Viewport width | Before document height | Final height | Signup CTA bottom | Overflow |
| --- | --- | --- | --- | --- |
| 1728 | 9,246 | 5,586 | 594 | None |
| 1440 | 9,246 | 5,562 | 580 | None |
| 1024 | 10,468 | 5,505 | 523 | None |
| 768 | 13,996 | 7,037 | 458 | None |
| 390 | 20,130 | 9,037 | 418 | None |

Heights and CTA positions are pixels. Initial live captures used a 1000px viewport height; final local captures used 900px. The old hero was viewport-height dependent, so page-length percentages are approximate, not a controlled performance metric. The free CTA is also above the fold in an 844px-tall mobile browser. Reviewed hero wrapping, section alignment, all product stages, navigation, pricing, table overflow containment, and footer layout.

[Open the side-by-side viewport viewer](../.launch-audit/homepage-review.html). [Desktop hero comparison](../.launch-audit/homepage-before-after.png).

Runtime files: `src/app/page.tsx`; landing `Hero.tsx`, `Header.tsx`, `MarketSection.tsx`, `PricingSection.tsx`; new `CardJourney.tsx`, `LifecycleStory.tsx`, and scoped `Homepage.module.css`. Tests: new `homepage-lifecycle.spec.ts`, adjusted public smoke/source contracts, and two updated homepage image baselines. No dependency was added. Shared Header changes also affect the header on Security, Privacy, and Terms; legal body content and links remain intact.

Logs are in `.launch-audit/homepage-final-{build,types,tests,lint,focused-lint,e2e}.log` (the final browser run also builds production through the existing HTTPS fixture). Existing unrelated checkout changes were preserved. No commit, push, PR, deployment, or production configuration change was performed. A release decision remains separate from this local redesign; underlying production certification gates remain open.
