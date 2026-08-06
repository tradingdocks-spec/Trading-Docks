# Mobile Accessibility Standard

Status: Implemented as the accessibility standard for active mobile redesign work.

## Minimum Bar

- Every icon-only control has an accessibility label.
- Every selectable control exposes selected state.
- Every disabled or loading control exposes disabled or busy state.
- Every error surface has visible text and alert semantics where supported.
- Status is never communicated by color alone.
- Touch targets are at least 44 px; primary mobile controls target 48 px or larger.
- Focus order follows visual order.
- Dynamic type must not create clipped buttons, one-word columns, or hidden primary actions.
- Bottom navigation and pinned strips must not cover content.

## Screen Requirements

- Hero content must be reachable before tertiary actions.
- Primary action must be obvious by label, placement, and visual weight.
- Advanced controls should move to sheets when they crowd the first viewport.
- Long card names, workspace names, set names, and emails must wrap gracefully.
- Empty/loading/error states must be specific and recoverable.

## Scanner Requirements

- Main status uses one visible instruction.
- Torch, Capture, and Search controls have explicit labels.
- Failed recognition uses "Couldn't read the card" plus Retake/Search.
- Diagnostics are development-only and not announced in normal scanner flow.
- Reduced motion suppresses decorative pulse/flash.

## QA Matrix

Verify on:

- 320 px width.
- 375 px width.
- 390 px width.
- 430 px width.
- Small iPhone height.
- Large iPhone height.
- Common Android phone.
- Narrow Expo Web.
- Large accessibility text.
- Reduced motion.
- Offline.
- Empty, loading, error, stale, and success states.

## Known Gaps

- Physical-device VoiceOver and TalkBack testing still require manual QA.
- Camera preview framing and Dynamic Island safe-area behavior require device validation.
- Admin mobile accessibility is deferred until customer-facing screens stabilize.
