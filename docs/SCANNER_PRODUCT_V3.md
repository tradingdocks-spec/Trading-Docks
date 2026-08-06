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
- One instruction at a time: Place card, Hold steady, Reading, Added, Remove card, Ready for next card, or Couldn't identify.
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

Single Scan capture-quality gates:

- Implemented: Capture is blocked until the card is detected, centered, stable, and sharp enough.
- Implemented: Card fill targets roughly 70-90% of the guide before OCR runs.
- Implemented: Too-small cards show Move closer; blurry cards show Tap card to focus; moving cards show Hold steady.
- Implemented: A brief focus-settle window prevents immediate OCR after tap-to-focus.
- Implemented: Still-capture crop mapping uses the actual camera view dimensions because the guide is rendered in view coordinates, not native preview-buffer coordinates.
- Implemented: Development diagnostics can show a crop proof overlay for the full captured image, card crop, title crop, and collector crop. Captured images are not retained outside development diagnostics.

Single Scan OCR order:

1. Tight title band.
2. Expanded title band.
3. Upper 25% of the card.
4. Full card.
5. Optional collector region after a title signal exists.

The sequence stops once a strong usable title is found and does not require collector-number OCR before card lookup.

## Review List

Review List is the post-processing queue.

Implemented structure:

- Header: Review List and card count.
- Summary: cards, needs review, offer.
- Tabs: Needs review, All, Done.
- Compact rows with image, name, printing, condition, finish, market, offer, status, and chevron.
- Review sheet with image, name, printing, quantity, condition, finish, market, cash percentage, offer, Save and mark reviewed, Choose another printing, Remove, and More options.
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
- Planned: Physical-device OCR QA must compare raw and preprocessed title crops before any image preprocessing is enabled.

## Inspiration Boundaries

Reference TCG scanning products informed the workflow hierarchy: scan modes, automatic/manual separation, review queue, progressive disclosure, and camera-first presentation. Trading Docks does not copy reference layouts, colors, icons, wording, or interaction details literally.

## Validation Checkpoint

Status: Implemented for Scanner Product V3 shell, Automatic Scan, Single Scan, and Review List polish.

Validated in this sprint:

- Root TypeScript.
- Mobile TypeScript.
- Focused Scanner Product V3 lint.
- Focused scanner, OCR, camera, offer, and Review List tests.
- Full mobile test suite.
- Native vision stack version verification.
- Expo web export.
- Expo prebuild config inspection.
- Expo install check.
- Apple autolinking search and resolve for `trading-docks-vision-ocr`.
- `git diff --check`.

Remaining manual QA:

- Physical iOS development build camera pass.
- Physical Android development build camera pass.
- Small iPhone, large iPhone, Android phone, and Expo Web narrow viewport review.
- Long card names, large text, denied camera permission, low light, no network, and repeated scan sessions.
