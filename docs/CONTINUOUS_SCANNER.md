# Continuous Scanner

## Current Status

- Implemented: `mobile/services/continuous-offer-scanner.ts` defines the continuous scanner state machine, card-guide geometry, quality checks, duplicate protection, session model, offer math, local persistence key, filters, undo/remove helpers, confirmation handoff, and CSV serialization.
- Implemented: The mobile Scan tab now presents a session-first intake workflow, a standard trading-card guide, session mode selection, recent scanned lines, running totals, offer totals, manual pricing, and an explicit Session Review route.
- Implemented: The guide ratio is based on 63 mm x 88 mm cards: `width / height = 0.7159`.
- Partially Implemented: Live boundary, motion, blur, glare, lighting, OCR, artwork, set-symbol, and foil checks are contracts and state-machine inputs. The active camera screen does not yet receive real frame-analysis events.
- Partially Implemented: Auto-capture logic exists as a tested runtime decision, but native frame-provider wiring is still required before the app can truly capture hands-free from live camera frames.
- Planned: Add native frame processing, OCR, artwork/layout matching, set-symbol detection, collector-info crop parsing, and benchmarked foil analysis after provider/privacy approval.

## State Machine

- Implemented: States are `idle`, `detecting_card`, `aligning`, `stabilizing`, `quality_check`, `capturing`, `recognizing`, `review_required`, `confirmed`, `cooldown`, and `ready_for_next`.
- Implemented: Auto-capture becomes eligible only when the boundary observation reports all four corners visible, card inside guide, acceptable fill, acceptable perspective, low motion, low blur, acceptable lighting, acceptable glare unless foil-analysis mode is active, and sufficient stability.
- Implemented: Initial stability target is configurable and defaults to 700 ms.
- Implemented: Duplicate protection tracks recent image fingerprints, recent exact printing ids, cooldown timing, card-removal state, and stable scan ids.
- Partially Implemented: The active UI shows these as pending live-provider checks instead of claiming real-time vision is available.

## Live Guidance

- Implemented: Quality guidance vocabulary includes `Move closer`, `Move farther away`, `Center the card`, `Hold steady`, `Reduce glare`, `Improve lighting`, `Card edge not visible`, `Tilt slightly for foil check`, and `Ready to scan`.
- Implemented: Guidance is textual and not color-only.
- Planned: Bind guidance to a real boundary provider so camera mode updates continuously while a card is in frame.

## Recognition Honesty

- Implemented: Magic recognition remains metadata-backed and confirmation-first.
- Implemented: Session lines record recognition method, top candidate, top three alternatives, per-signal confidence, missing signals, conflicting signals, finish result, and confidence state.
- Partially Implemented: The active UI uses manual Scryfall search plus the Magic adapter. It does not claim OCR, artwork matching, foil recognition, or exact-printing visual certainty.
- Planned: Lower-friction confirmation requires benchmark evidence from private labeled fixtures.

## Privacy

- Implemented: Scanner session records do not store captured images.
- Implemented: Captured images are not uploaded by default.
- Implemented: Session persistence is scoped by user id.
- Planned: Remote image processing requires explicit consent, retention controls, HTTPS-only provider communication, and sanitized telemetry.

## Remaining Work

- Planned: Wire a real live frame provider into the state machine.
- Planned: Add physical-device QA for iOS and Android camera timing, safe areas, glare, sleeves, low light, and rapid card replacement.
- Planned: Add native share/email export surfaces. Current export support produces CSV data only after explicit user action.
