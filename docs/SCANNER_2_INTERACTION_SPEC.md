# Scanner 2.0 Interaction Specification

Status: Implemented as the sprint contract for the mobile Scanner 2.0 route.

Scanner 2.0 is a camera-first Trading Docks vision terminal for high-speed TCG intake. The interaction model preserves the existing Apple Vision OCR, Magic title recognition, Scryfall candidate lookup, top-three candidates, scanner session insertion, offer math, temporary-image cleanup, manual fallback, diagnostics, and user-scoped persistence systems.

## Product Principle

The scanner should feel closer to a professional card-show buying terminal than a settings screen. The camera is the primary surface, the instruction is the primary text, the latest result is compact, and session totals stay pinned and glanceable.

Primary hierarchy:

1. Camera
2. Active instruction
3. Latest recognition result
4. Session totals
5. Secondary controls

## State Model

| State | Primary Message | Guide Appearance | Controls | Result Behavior | Haptics | Accessibility Announcement | In | Out | Timeout / Recovery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launching | Loading scanner | No guide | None | No result | None | Loading scanner | Route mount | camera_ready, offline, camera_error | Show loading state until context resolves or error appears |
| camera_ready | Camera ready | Dim slate brackets | Capture, torch, pause, manual search | Existing result remains until next capture or clear | None | Camera ready | Permission granted and camera active | card_absent, card_present, paused, capturing | Manual search remains available |
| card_absent | Place the card inside the guide | Dim slate brackets | Capture fallback, torch, pause, manual search | No new result | None | Place card in guide | Camera ready without stable card signal | card_present, paused | Keep camera active |
| card_present | Center card | Cyan brackets | Capture fallback, torch, pause, manual search | No new result | Light selection in future native implementation | Card detected | Vision frame sees card-like boundary | aligning, stabilizing, capturing | Fall back to card_absent if card leaves frame |
| aligning | Center card | Cyan brackets with directional cue | Capture fallback, torch, pause, manual search | No new result | None | Center card | Card present but off-center, rotated, too close, too far, or edge-hidden | stabilizing, card_absent, paused | Continue guidance |
| stabilizing | Hold steady | Cyan to emerald brackets with restrained progress | Capture fallback, torch, pause, manual search | No new result | None | Hold steady | Card is aligned but stability timer is not complete | capturing, aligning, card_absent, paused | Reset timer if motion/blur changes |
| capturing | Reading card | White capture flash once | Controls disabled except pause where safe | Result remains unchanged until OCR completes | Selection haptic in future native implementation | Capturing card | Manual capture or auto-capture gate | reading, failed | Prevent double capture until completion |
| reading | Reading card | Blue processing brackets | Capture disabled, pause safe, manual search available | No result update yet | None | Reading card | Temporary image captured, Apple Vision OCR running | searching, failed | Cleanup temporary image on completion |
| searching | Finding match | Blue processing brackets | Capture disabled, pause safe, manual search available | No result update yet | None | Finding match | OCR title available and catalog lookup begins | recognized, likely, ambiguous, failed | Network/service errors become failed with safe copy |
| recognized | Match found | Emerald success pulse once | Capture, correct, undo, manual search | Compact result tray, ready to add/session confirm | Success haptic in future native implementation | Match found | Candidate passes recognized threshold | added, remove_card, correcting, rearming | Auto-add only when current safety rules allow |
| likely | Review printing | Amber guide | Confirm, correct, alternatives, manual search | Compact result tray with one-tap confirmation | Light notification in future native implementation | Likely match, review printing | Candidate exists but confidence requires confirmation | added, ambiguous, correcting, rearming | Keep top candidate visible |
| ambiguous | Choose printing | Amber guide | Candidate sheet, manual search, retake | Compact tray plus expandable top-three candidate sheet | Warning haptic in future native implementation | Multiple possible printings | Top-three candidates require user choice | likely, added, failed, rearming | Do not block camera with full-screen confirmation |
| failed | Couldn't identify card | Amber/red brackets without pulsing | Retake, search manually | Small failure banner only | Warning haptic in future native implementation | Could not identify card | No title, no match, network/service issue, invalid response | rearming, paused, manual search | No unknown session row; details go to diagnostics only |
| added | Added | Emerald bracket pulse once | Undo, correct, capture | Compact result remains briefly | Success haptic in future native implementation | Added to session | Session insertion succeeds | remove_card, rearming | Undo window remains short and visible |
| remove_card | Remove card | Emerald brackets, removal instruction | Pause, manual search, settings | Latest result remains compact | None | Remove card to scan next | Duplicate prevention awaits card removal | rearming | Do not scan same stationary card twice |
| rearming | Ready for next card | Dim slate brackets | Capture, torch, pause, manual search | Latest result may collapse | None | Ready for next card | Card leaves frame or user retakes | card_absent, card_present, capturing | Reset per-capture race token |
| paused | Scanner paused | Slate paused guide | Resume, manual search, settings | Existing result remains | None | Scanner paused | User pauses camera or app lifecycle pauses preview | camera_ready, offline | Resume should not replay stale capture |
| offline | Offline | Slate/amber guide | Manual search from cache, retry, pause | Cached result only if user-scoped and fresh | None | Offline | Network state unavailable during lookup | camera_ready, searching, failed | User-visible network recovery |
| camera_error | Camera unavailable | No camera guide | Retry permission, manual search | No scanner result | Warning haptic in future native implementation | Camera unavailable | Permission denied, unavailable camera, native camera error | camera_ready, manual search | Manual search remains usable |

## Transition Diagram

```mermaid
stateDiagram-v2
  [*] --> launching
  launching --> camera_ready
  launching --> offline
  launching --> camera_error
  camera_ready --> card_absent
  camera_ready --> card_present
  card_absent --> card_present
  card_present --> aligning
  aligning --> stabilizing
  stabilizing --> capturing
  camera_ready --> capturing
  capturing --> reading
  reading --> searching
  searching --> recognized
  searching --> likely
  searching --> ambiguous
  searching --> failed
  recognized --> added
  likely --> added
  ambiguous --> likely
  ambiguous --> added
  failed --> rearming
  failed --> camera_ready
  added --> remove_card
  remove_card --> rearming
  rearming --> card_absent
  rearming --> card_present
  camera_ready --> paused
  card_absent --> paused
  card_present --> paused
  paused --> camera_ready
  searching --> offline
  offline --> camera_ready
  camera_error --> camera_ready
```

## Reliability Rules

- Camera opens automatically after context load and permission availability.
- Manual search is always available when camera or network is unavailable.
- A scan has one active processing token; stale lookup completion must not overwrite a newer retake.
- Capture is disabled while capture, OCR, or lookup is active.
- Failed scans never create unknown session rows.
- Failure details are diagnostic-only; normal UI uses safe recovery copy.
- Title-only OCR may produce candidates, but exact-printing confidence stays capped.
- Same stationary card must not be captured again until removal/rearm.

## Accessibility Rules

- Icon controls must have accessibility labels.
- State changes require visible text in addition to color.
- Result actions must remain reachable at 320 px width and large text scale.
- Candidate selection exposes selected state and exact printing metadata.
- Reduced-motion mode suppresses pulse/flash embellishments while preserving text state.
