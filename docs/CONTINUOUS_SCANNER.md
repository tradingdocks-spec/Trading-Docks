# Continuous Scanner

## Current Status

- Implemented: `mobile/services/continuous-offer-scanner.ts` defines the continuous scanner state machine, card-guide geometry, quality checks, duplicate protection, session model, offer math, local persistence key, filters, undo/remove helpers, confirmation handoff, and CSV serialization.
- Implemented: The mobile Scan tab now presents a session-first intake workflow, a standard trading-card guide, session mode selection, recent scanned lines, running totals, offer totals, manual pricing, and an explicit Session Review route.
- Implemented: The guide ratio is based on 63 mm x 88 mm cards: `width / height = 0.7159`.
- Implemented: `mobile/services/live-card-recognition.ts` adds a replaceable live-frame analyzer for local luma frames. It detects card bounds, four visible corners, 63:88 aspect-ratio fit, guide containment/fill, blur, motion, lighting, glare, a normalized crop contract, image fingerprint, and a single concise guidance message.
- Implemented: The analyzer uses a configurable 650 ms stability window for auto-capture readiness decisions.
- Partially Implemented: Auto-capture can now be evaluated from normalized frame samples, but the active Scan tab still needs native frame delivery from the development-build camera before hands-free capture is operational on devices.
- Partially Implemented: OCR mapping exists for targeted title, set-code, collector-number, language, and collector-info regions, but the OCR provider itself is still a contract.
- Planned: Add native frame-processor bridge wiring, OCR, artwork/layout matching, set-symbol detection, perspective-corrected image output, and benchmarked foil analysis after provider/privacy approval.

## State Machine

- Implemented: States are `idle`, `detecting_card`, `aligning`, `stabilizing`, `quality_check`, `capturing`, `recognizing`, `review_required`, `confirmed`, `cooldown`, and `ready_for_next`.
- Implemented: Auto-capture becomes eligible only when the boundary observation reports all four corners visible, card inside guide, acceptable fill, acceptable perspective, low motion, low blur, acceptable lighting, acceptable glare unless foil-analysis mode is active, and sufficient stability.
- Implemented: Initial stability target is configurable and defaults to 700 ms in the continuous scanner state machine; the live analyzer overrides this to 650 ms for the first physical-device calibration pass.
- Implemented: Duplicate protection tracks recent image fingerprints, recent exact printing ids, cooldown timing, card-removal state, and stable scan ids.
- Partially Implemented: The active UI shows these as pending live-provider checks instead of claiming real-time vision is available.

## Live Guidance

- Implemented: Quality guidance vocabulary includes `Move closer`, `Move farther away`, `Center the card`, `Hold steady`, `Reduce glare`, `Improve lighting`, `Card edge not visible`, `Tilt slightly for foil check`, and `Ready to scan`.
- Implemented: Guidance is textual and not color-only.
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
- Planned: Add native share/email export surfaces. Current export support produces CSV data only after explicit user action.
