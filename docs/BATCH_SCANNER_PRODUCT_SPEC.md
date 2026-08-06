# Batch Scanner Product Spec

Status: Implemented for the active mobile Scan route.

## Product Principle

Implemented: The scanner now follows "Scan first. Review the list later." The active camera surface is optimized for rapid batch intake instead of per-card confirmation.

Implemented: High-confidence, likely, and ambiguous matches are added to the session Review List immediately when a supported candidate exists. Failed reads do not create unknown rows.

## Active Scanner Surface

Implemented: The active scanner keeps a compact top HUD, full-screen camera, reactive guide, one visible instruction, Torch, Manual Capture, Search, a transient latest-scan notice, and a compact Review List chip.

Implemented: The active scanner no longer shows the full result card, Add button, confidence badge, "Why this match?", pricing fields, quantity/condition/finish controls, review status controls, totals grid, large session bar, duplicate add/remove panels, or card metadata.

Implemented: The top HUD shows the session mode and scanned count on the first line. Offer and review count remain optional second-line context.

Implemented: Pause and scanner defaults live behind the settings control. Primary controls hide while capture, OCR, Scryfall lookup, sheets, or remove-card lockout are active.

## Auto-Add Rules

Implemented: High-confidence matches are added as Suggested. They are not silently finalized.

Implemented: Likely and ambiguous matches are added as Needs review. Ambiguous entries preserve the recognition top candidates through the session recognition report.

Implemented: Failed reads show a compact Retake/Search recovery overlay and do not add a placeholder row.

Implemented: Manual search selection adds the selected printing to the Review List and returns to the camera.

## Review List Ownership

Implemented: Batch decisions, quantity, condition, finish, language, pricing, review status, removal, and finalization live in Scanner Session Review.

Implemented: The scanner bottom chip uses the compact format `12 scanned - 2 review - Review List` in product copy and `12 scanned • 2 review` in the mobile chip.

Partially Implemented: Choosing an alternate printing from the Review List remains planned. The current review sheet exposes a disabled placeholder rather than inventing replacement behavior.

## Reliability

Implemented: Batch inserts use stable scan ids and existing session persistence. Successful batch adds mark duplicate protection and require card removal before the next automatic scan.

Implemented: Failed reads remain recoverable and do not force remove-card lockout.

Implemented: User-scoped session storage and existing scanner replay architecture remain unchanged.

Requires Production Configuration: Physical iPhone and Android QA is required for real camera pacing, VoiceOver/TalkBack, bright venue lighting, poor network, and long sessions.
