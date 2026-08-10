# Mobile Visual Migration Wave 3

Status: Implemented as the Wave 3 specification for final mobile release-quality polish.

## Scope

Wave 3 covers the active mobile Admin / Command Center, Settings, Scanner Recovery, dev-only Design System showcase, global consistency audit, final accessibility pass, final responsive pass, and release QA documentation.

The work is polish and consistency only. It must not change OCR, scanner recognition, billing, memberships, Supabase schemas, route authority, native module registration, or production feature behavior.

## Admin / Command Center

- Purpose: Give authorized owner/admin/support/analyst users a mobile-safe operational summary and clear links to deeper admin tools.
- Hero: Command Center identity with platform role, account context, and real overview counts when available.
- Primary action: Open the highest-priority supported admin area from concise action rows.
- Deferred information: Dense management tables, bulk operations, role mutation details, and audit-heavy controls stay on dedicated admin routes.
- Component usage: `TDNavigationHeader`, `TDMetric`, `TDListRow`, `TDBadge`, `TDStatusIndicator`, `TDEmptyState`, and `TDErrorState`.
- Responsive behavior: Summary rows wrap cleanly at 320 px and do not resemble a compressed desktop dashboard.
- Accessibility requirements: Admin role is text-visible, actions are labeled, destructive or sensitive flows stay separated on dedicated routes.
- Acceptance criteria: Admin remains additive to normal workspace, uses `user_roles` authority, shows real data only, and avoids email-based role assumptions.

## Deep Settings

- Purpose: Provide one consistent settings-row pattern for account, membership, security, scanner, notifications, appearance, preferences, business, support, privacy, and sign-out.
- Hero: Settings identity and current configuration status.
- Primary action: Toggle or open the most relevant setting in each group.
- Deferred information: Provider setup, environment diagnostics, and development-only scanner diagnostics remain hidden from normal users.
- Component usage: `TDNavigationHeader`, `TDListRow`, `TDSectionHeader`, `TDStatusIndicator`, `TDBadge`, `TDButton`.
- Responsive behavior: Long email, workspace, and setting values wrap without horizontal scroll.
- Accessibility requirements: Toggles expose checked state, icon-only back control is labeled, and destructive/sign-out actions are visually separated.
- Acceptance criteria: Settings groups are consistent, no nested card-on-card layout remains, and technical details are not shown to normal users.

## Scanner Recovery

- Purpose: Help users recover queued or failed scanner adds without exposing implementation details.
- Hero: Scanner sync state for the current signed-in user.
- Primary action: Retry all when queued entries exist, otherwise return to scanner.
- Deferred information: Idempotency, raw operation IDs, and technical error details go to diagnostics/docs, not normal UI.
- Component usage: `TDNavigationHeader`, `TDListRow`, `TDStatusIndicator`, `TDBadge`, `TDButton`, `TDEmptyState`, `TDErrorState`, `TDLoadingState`.
- Responsive behavior: Queued scan rows stay compact at 320 px and actions wrap without clipping.
- Accessibility requirements: Failed/action-required states include text labels; discard requires explicit confirmation.
- Acceptance criteria: No unknown session rows are created, failed entries remain visible, and retry/discard behavior remains user-scoped.

## Scanner Recovery Matrix

| Error code | User-facing copy | Primary action | Secondary action | Camera behavior | Session behavior | Retry behavior | Diagnostics behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `no_title` | We could not read the card name. | Retake | Manual Search | Resume after retake | Preserve current session | Requires new capture or search | Record OCR region details |
| `no_match` | No card match was found. | Manual Search | Retake | Resume after recoverable failure | Preserve current session | Retry lookup if title exists | Record lookup query and candidate count |
| `network_failure` | Connection dropped during lookup. | Retry | Manual Search | Keep captured text when available | Preserve current session | Retry without recapture when OCR title exists | Record network status and endpoint stage |
| `service_failure` | Card lookup is unavailable right now. | Retry | Manual Search | Keep captured text when available | Preserve current session | Retry without recapture when OCR title exists | Record provider error safely |
| `camera_denied` | Camera access is off. | Open Settings | Manual Search | Do not auto-resume | Preserve current session | Requires permission change | Record permission state only |
| `camera_unavailable` | Camera is unavailable on this device. | Manual Search | Try Again | Do not auto-resume until available | Preserve current session | Retry camera readiness | Record platform and availability |
| `capture_failed` | Capture did not complete. | Retake | Manual Search | Resume unless user paused | Preserve current session | Requires recapture | Record capture stage |
| `stale_result` | A newer scan replaced this result. | Continue scanning | Manual Search | Continue latest scan state | Preserve current session | Do not retry stale response | Record cancellation reason |
| `duplicate_stationary_card` | Remove the card before scanning it again. | Remove card | Pause | Wait for removal | Preserve current session | Rearm after removal | Record duplicate guard state |
| `explicit_pause` | Scanner paused. | Resume | Manual Search | Respect pause | Preserve current session | Retry only after resume/manual action | Record pause source |

## Dev Design-System Showcase

- Purpose: Give engineers a gated reference for active primitives, states, narrow widths, dynamic type samples, reduced motion notes, and scanner-specific surfaces.
- Hero: Development-only primitive catalog.
- Primary action: None in production; route returns null unless the explicit development flag is enabled.
- Deferred information: Customer data, fake metrics, and production-facing debug copy remain excluded.
- Component usage: Every active TD primitive should have at least one visible example.
- Responsive behavior: Showcase uses narrow rows and wrapping samples to expose small-width behavior.
- Accessibility requirements: Icon-only examples include labels; state examples include disabled/loading/error semantics.
- Acceptance criteria: Showcase is gated, not production-exposed, and contains no customer data.

## Global Consistency Audit

- Purpose: Verify all active mobile routes against gutters, headers, spacing, typography, icon family, button hierarchy, state surfaces, safe areas, and technical-copy rules.
- Hero: Documentation-backed release-readiness inventory.
- Primary action: Fix minor safe issues; document deferred issues with reasons.
- Deferred information: Risky rewrites and dense admin management tools are deferred.
- Component usage: Prefer TD primitives where safe; document intentional exceptions.
- Responsive behavior: 320, 375, 390, 430 widths and narrow Expo Web remain release QA targets.
- Accessibility requirements: Labels, status text, touch targets, focus order, dynamic type, reduced motion, and bottom-nav clearance remain required.
- Acceptance criteria: `docs/MOBILE_FINAL_CONSISTENCY_AUDIT.md` records every active route as aligned, minor issue fixed, or deferred with reason.
