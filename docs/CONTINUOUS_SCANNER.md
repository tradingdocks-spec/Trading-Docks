# Continuous Scanner

## Current Status

- Implemented: `mobile/services/continuous-offer-scanner.ts` defines the continuous scanner state machine, card-guide geometry, quality checks, duplicate protection, session model, offer math, local persistence key, filters, undo/remove helpers, confirmation handoff, and CSV serialization.
- Implemented: The mobile Scan tab now presents a camera-first intake workflow with a standard trading-card guide, compact running totals, latest-result tray, manual pricing, and an explicit Session Review route.
- Implemented: Scanner settings, manual search, diagnostics, and privacy copy are secondary panels so the primary camera workflow stays uninterrupted.
- Implemented: The guide ratio is based on 63 mm x 88 mm cards: `width / height = 0.7159`.
- Implemented: `mobile/services/scanner-vision-engine.ts` adds replaceable luma-frame providers for card presence, boundary, perspective, motion, blur, lighting, glare, card removal, frame quality, and region extraction.
- Implemented: The Vision Engine detects card bounds, four visible corners, 63:88 aspect-ratio fit, rotation, perspective, guide containment/fill, center offset, edge visibility, blur, motion, lighting, glare, distance, stability, normalized crop metadata, image fingerprint, and a single concise guidance message.
- Implemented: The analyzer uses a configurable 650 ms stability window for auto-capture readiness decisions.
- Implemented: `mobile/services/native-scanner-calibration.ts` prevents native auto-capture when required physical observation signals are unavailable and records diagnostics for device QA.
- Implemented: The Scan tab waits for `onCameraReady` before capture and records an explicit session outcome for local stills even when identification is unavailable.
- Partially Implemented: Auto-capture can now be evaluated from normalized frame samples, but the active Scan tab still needs native frame delivery from the development-build camera before hands-free capture is operational on devices.
- Partially Implemented: OCR mapping exists for targeted title, set-code, collector-number, language, and collector-info regions, but the OCR provider itself is still a contract.
- Planned: Add native frame-processor bridge wiring, OCR, artwork/layout matching, set-symbol detection, perspective-corrected image output, and benchmarked foil analysis after provider/privacy approval.

## State Machine

- Implemented: States are `idle`, `detecting_card`, `aligning`, `stabilizing`, `quality_check`, `capturing`, `recognizing`, `review_required`, `confirmed`, `cooldown`, and `ready_for_next`.
- Implemented: Auto-capture becomes eligible only when the boundary observation reports all four corners visible, card inside guide, acceptable fill, acceptable perspective, low motion, low blur, acceptable lighting, acceptable glare unless foil-analysis mode is active, and sufficient stability.
- Implemented: The native scanner calibration guard also requires the camera-ready event and real availability for boundary, corner, perspective, blur, motion, lighting, and glare signals. Unavailable signals do not count as passing observations.
- Implemented: Initial stability target is configurable and defaults to 700 ms in the continuous scanner state machine; the live analyzer overrides this to 650 ms for the first physical-device calibration pass.
- Implemented: Duplicate protection tracks recent image fingerprints, recent exact printing ids, cooldown timing, card-removal state, and stable scan ids.
- Partially Implemented: The active UI shows these as pending live-provider checks instead of claiming real-time vision is available.

## Live Guidance

- Implemented: Quality guidance vocabulary includes `Move closer`, `Move farther away`, `Center the card`, `Hold steady`, `Reduce glare`, `Improve lighting`, `Card edge not visible`, `Tilt slightly for foil check`, and `Ready to scan`.
- Implemented: Guidance is textual and not color-only.
- Implemented: The premium Scan tab promotes one concise instruction at a time and maps internal capture/recognition progress to product-facing states such as `Reading card`, `Finding printing`, `Match found`, `Review printing`, `Remove card`, and `Ready for next card`.
- Implemented: Live-frame analysis returns one primary user guidance value at a time: `Place card inside frame`, `Move closer`, `Move farther away`, `Center card`, `Show all four edges`, `Hold steady`, `Improve lighting`, `Reduce glare`, or `Ready`.
- Planned: Bind the analyzer to VisionCamera frame delivery so camera mode updates continuously while a card is in frame.

## Recognition Honesty

- Implemented: Magic recognition remains metadata-backed and confirmation-first.
- Implemented: Session lines record recognition method, top candidate, top three alternatives, per-signal confidence, missing signals, conflicting signals, finish result, and confidence state.
- Partially Implemented: Live analyzer output can feed the Magic adapter through targeted OCR/artwork observation contracts. The active UI uses manual Scryfall search plus the Magic adapter and does not claim OCR, artwork matching, foil recognition, or exact-printing visual certainty.
- Planned: Lower-friction confirmation requires benchmark evidence from private labeled fixtures.

## Privacy

- Implemented: Scanner session records do not store captured images.
- Implemented: Captured images are not uploaded by default.
- Implemented: Session persistence is scoped by user id.
- Implemented: Live-frame analysis accepts transient in-memory luminance samples and returns metrics/fingerprints only; it does not log, retain, or export source images.
- Planned: Remote image processing requires explicit consent, retention controls, HTTPS-only provider communication, and sanitized telemetry.

## Remaining Work

- Planned: Wire VisionCamera frame processing into the Scan tab and continuous state machine in a custom Expo development build.
- Planned: Add physical-device QA for iOS and Android camera timing, safe areas, glare, sleeves, low light, and rapid card replacement.
- Planned: Validate guide/crop mapping against real device preview scaling before enabling hands-free capture.
- Planned: Add native share/email export surfaces. Current export support produces CSV data only after explicit user action.
## Scanner 2.0 High-Volume Workflow

Status: Partially Implemented.

Card Show mode is the default scanner session mode for the premium scanner shell. Implemented behavior includes:

- default condition
- default finish
- default language
- default cash offer rate
- default destination
- running card, market, offer, and review totals
- compact result tray
- duplicate prevention and removal/rearm contract
- review session access from the pinned session strip

Planned behavior:

- automatic high-confidence acceptance when product safety rules allow it
- short undo window with native haptics
- optional sound
- native card-presence and removal signals from the full vision engine
