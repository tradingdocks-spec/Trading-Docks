# Scanner Session Review Product Spec

Status: Implemented as the current mobile Scanner Session Review presentation contract.

## Purpose

Implemented: Scanner Session Review answers five questions for a beginner: how many cards are in the session, what needs attention, what the current offer is, which card to review next, and how to finalize.

Not Changed: This screen continues to use the existing scanner session data, session persistence, offer calculations, CSV export, undo, removal, user isolation, and missing-price behavior.

## Simplified Hierarchy

Implemented hierarchy:

1. Compact navigation header.
2. Four-metric session summary.
3. Primary finalize action with eligibility copy.
4. Compact status segmentation.
5. Optional active-filter summary.
6. Collapsed card list.
7. Safe-area-aware sticky session actions.

Implemented: The main screen uses at most four primary metrics: Cards, Needs review, No price, and Offer total. Missing money values render as an em dash, never `$0.00`.

## Progressive Disclosure

Implemented: Game filters, confidence filters, missing-price-only, and sort order live in the filter sheet. The default main screen shows only status tabs and a compact active-filter summary when filters are active.

Implemented: Card editing lives in the card review sheet. Collapsed rows are tappable and do not expose inline text inputs, Review buttons, Remove buttons, or repeated section labels.

## Card Row Contract

Implemented: Collapsed rows show image or polished missing-image state, card name, game, set code, collector number, condition, finish, quantity, review/status badge, market value, offer value, and a disclosure chevron.

Implemented: Long card names are limited to two lines. Missing prices remain unavailable and are excluded from totals.

## Review Sheet Contract

Implemented: The card review sheet shows identity, confidence/status, quantity, condition, finish, language, market price, cash percentage, offer, concise confidence explanation, Mark reviewed or Save changes, disabled Choose another printing placeholder, and separated Remove card action.

Partially Implemented: Choosing another printing remains a future scanner/manual-search integration. The button is visible but disabled so the current release does not invent replacement-printing behavior.

## Review-Next Workflow

Implemented: Needs-review cards sort first by default. Review next opens the oldest unresolved card, announces progress as reviewed count over total cards, and advances to the next unresolved card after Mark reviewed. Closing the sheet does not force advancement.

## Finalize Rules

Implemented: Finalize reviewed cards is enabled only when the session has cards and no cards remain in Needs review. Disabled state explains why. Finalization uses the existing `bulkConfirmReviewedCards` behavior and does not silently finalize unresolved cards.

## Responsive And Accessibility Rules

Implemented: Main controls avoid horizontal chip walls at 320-430 px widths. Sticky actions include safe-area padding and list bottom inset so the last card remains reachable.

Implemented: Icon actions have labels, rows expose button semantics, status text is not color-only, missing-price copy is plain language, destructive removal requires confirmation, and sheets are keyboard-aware.

## Remaining Limitations

Requires Production Configuration: Physical iOS and Android QA is still required for dynamic type, VoiceOver, TalkBack, keyboard overlap, home-indicator spacing, long session names, and 100-card performance.

Planned: Native share sheet/export history, printing replacement from the review sheet, and optional haptics remain future work.

## Repository Validation

Implemented: This branch passed root TypeScript, mobile TypeScript, focused lint, session-review UI tests, session persistence and offer calculation tests, full mobile tests, Expo web export, Expo config validation, Expo dependency check, Apple OCR autolinking search/resolve, and `git diff --check`.

Requires Production Configuration: Physical-device QA remains required before calling the Session Review experience release-complete.
