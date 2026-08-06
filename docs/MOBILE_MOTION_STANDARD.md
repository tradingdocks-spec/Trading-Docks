# Mobile Motion Standard

Status: Implemented as the motion and haptics standard for active mobile redesign work.

## Motion Principles

- Motion clarifies state, hierarchy, or feedback.
- Motion does not decorate idle screens.
- Scanner motion must feel steady and operational.
- Reduced motion always has a non-animated equivalent.

## Duration Scale

| Token | Duration | Use |
| --- | ---: | --- |
| Tap | 120 ms | Press feedback |
| Fast | 180 ms | Small row/state transitions |
| Standard | 260 ms | Sheet and tray transitions |
| Slow | 420 ms | Rare full-screen transitions |

## Allowed Motion

- Button and row press feedback.
- Sheet entrance and dismissal.
- Result tray entrance.
- Scanner capture flash.
- Scanner success/review feedback.
- List insertion when it clarifies newly added content.
- Tab selection feedback.

## Disallowed Motion

- Constant pulsing.
- Decorative loops.
- Large animated backgrounds.
- Glows that compete with primary actions.
- Animation that masks loading or failure.

## Haptics

- Capture: selection haptic.
- Success: success notification.
- Review required: warning/light notification.
- Destructive confirmation: warning haptic.
- Tab change: selection haptic.

## Reduced Motion

When reduced motion is enabled:

- Disable decorative pulse and flash.
- Keep text/state updates visible.
- Preserve haptics only where user preference and platform allow.
- Avoid delaying actions for animation completion.
