# Scanner Product V3

## Status

- Implemented: The mobile Scan tab now opens a dedicated Scan Modes screen instead of the immersive camera.
- Implemented: Automatic Scan lives at `/scan/automatic` and preserves the native VisionCamera stack, Apple Vision OCR pipeline, frame analysis, auto-capture gates, camera selection, tap-to-focus, torch behavior, pricing enrichment, session persistence, offer calculations, Review List, user isolation, stale-capture guards, and duplicate protection.
- Implemented: Single Scan lives at `/scan/single` and uses manual capture, local still-image OCR, Scryfall-backed Magic lookup, one focused result sheet, Retake, and Add card into the existing scanner session model.
- Implemented: Review List remains at `/scanner-session` and is positioned as post-processing for suggested matches, pricing, review status, and finalization.
- Planned: Grid Scan is documented as a future separate mode but has no fake production route because multi-card recognition is not production-ready.

## Navigation Hierarchy

Primary mobile navigation:

1. Scan tab
2. Scan Modes
3. Automatic Scan, Single Scan, or Review List

Automatic Scan and Single Scan are outside the tab group so the camera can be immersive. Back returns to Scan Modes or the previous route. Review List can be reached from Scan Modes, Automatic Scan, and Single Scan.

## Scan Modes

Implemented rows:

- Automatic Scan: Hands-free scanning for fast intake.
- Single Scan: Capture and review one card.
- Review List: Review suggested matches and finish the session.

Planned row:

- Grid Scan: Future multi-card capture mode. It is described as planned, not routed as a working feature.

The modes screen uses large restrained rows, left icons, one-line descriptions, chevrons, generous spacing, and no technical camera terminology.

## Automatic Scan

Automatic Scan is the default workflow.

Visible surface:

- Top bar: Back, Automatic Scan, Settings.
- Secondary line: current session mode and scanned count.
- Full-screen camera.
- Four-corner TCG-ratio guide.
- One instruction at a time: Place card, Hold steady, Reading, Added, Remove card, Ready for next card, or Couldn’t identify.
- Bottom controls: Torch and Capture fallback.
- Small Review shortcut with scanned count.

Hidden from the active camera surface:

- Confidence percentages.
- Pricing and offer math.
- Card metadata.
- Condition and finish controls.
- Full result cards.
- Large review status panels.

Successful scans show a small transient toast and then require card removal before rearming.

## Single Scan

Single Scan is intentionally slower and more deliberate.

Flow:

1. Open camera.
2. User taps Capture.
3. Apple Vision OCR and Magic lookup run.
4. A focused result sheet appears.
5. User chooses Add card or Retake.

The result sheet shows image, card name, set/collector number, market value when available, offer value when available, Add card, and Retake. Add card writes into the same user-scoped scanner session storage used by Automatic Scan.

## Review List

Review List is the post-processing queue.

Implemented structure:

- Header: Review List and card count.
- Summary: cards, needs review, offer.
- Tabs: Needs review, All, Done.
- Compact rows with image, name, printing, condition, finish, market, offer, status, and chevron.
- Review sheet with image, name, printing, quantity, condition, finish, market, cash percentage, offer, Save & mark reviewed, Choose another printing, Remove, and More options.
- One sticky Finalize action.

## Camera Controls

- Lens selection uses supported device options only.
- User-visible choices are Auto, Close-up, Standard, and Telephoto where supported.
- Raw device IDs are development-only in Camera Inspector and Camera QA.
- Tap-to-focus uses the shared scanner camera adapter and visible reticle.
- Torch is treated as illumination, not still-photo flash.

## Visual Hierarchy

Trading Docks scanner V3 uses:

- Near-black navy camera stage.
- Deep navy elevated surfaces.
- Electric blue primary action.
- Cyan scanning guide.
- Emerald success.
- Amber review states.
- Restrained coral danger states.

Hierarchy should come from spacing, typography, scale, placement, and subtle elevation rather than dense borders or permanent panels.

## Accessibility And Motion

- Implemented: Large touch targets on Scan Modes, camera controls, Review List rows, and sheets.
- Implemented: VoiceOver labels for mode rows, camera preview focus, controls, and review rows.
- Implemented: State is communicated with text, not color alone.
- Implemented: Reduced motion suppresses scanner guide pulse/flash patterns where supported by existing scanner motion logic.
- Planned: Physical-device QA must verify 320, 375, 390, and 430 px widths, Dynamic Island, home indicator, large text, long names, and bottom-sheet overlap.

## Inspiration Boundaries

Reference TCG scanning products informed the workflow hierarchy: scan modes, automatic/manual separation, review queue, progressive disclosure, and camera-first presentation. Trading Docks does not copy reference layouts, colors, icons, wording, or interaction details literally.
