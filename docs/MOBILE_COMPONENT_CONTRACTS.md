# Mobile Component Contracts

Status: Implemented as the mobile design-system contract.

## Source Of Truth

`mobile/components/design-system.tsx` is the active mobile primitive barrel. It consumes tokens from `mobile/design/*`, which adapt the shared Trading Docks token ownership documented in `docs/DESIGN_SYSTEM.md`.

Do not create a second mobile design system. Legacy primitives may remain only until migrated.

## Core Primitives

| Primitive | Status | Contract |
| --- | --- | --- |
| `TDScreen` | Implemented | Base screen shell with mobile gutters and wide constraints. |
| `TDText` | Implemented | Semantic typography variants and tones. |
| `TDButton` | Implemented | Primary/secondary/ghost/danger actions with loading and disabled accessibility. |
| `TDIconButton` | Implemented | Icon-only action with required accessible label. |
| `TDCard` | Implemented | Elevated content or repeated item surface. Avoid nesting. |
| `TDInput` | Implemented | Labeled input with error association and optional icons. |
| `TDBadge` | Implemented | Short status only. |
| `TDChip` | Implemented | Compact selectable filter/status control. |
| `TDMetricTile` / `TDMetric` | Implemented | Compact measured values. Do not invent values. |
| `TDListRow` | Implemented | Preferred row surface for settings, storage, exchange, and profile lists. |
| `TDSectionHeader` | Implemented | Compact section title with optional action. |
| `TDSheet` | Implemented | Modal/sheet surface for deferred controls. |
| `TDSegmentedControl` | Implemented | Small option-set control. |
| `TDResultTray` | Implemented | Compact recognition/result surface. |
| `TDEmptyState` | Implemented | Specific empty state with next action. |
| `TDErrorState` | Implemented | Recovery-focused error state. |
| `TDLoadingState` | Implemented | Blocking loading state. |
| `TDSkeleton` | Implemented | Layout-preserving loading placeholder. |
| `TDToast` | Implemented | Compact transient status. |
| `TDStatusIndicator` | Implemented | Dot-plus-label status, never color-only. |
| `TDNavigationHeader` | Implemented | Compact contextual screen header. |
| `TDScannerGuide` | Implemented | Four-corner scanner guide primitive. |
| `TDSessionStrip` | Implemented | One-row scanner/session totals above navigation. |

## Migration Rules

- Prefer `TDListRow` over standalone cards for settings and operational lists.
- Prefer `TDIconButton` for header utilities.
- Prefer `TDSegmentedControl` for mutually exclusive compact modes.
- Prefer `TDSheet` for settings, advanced filters, diagnostics, and correction tools.
- Prefer `TDResultTray` for scanner and transaction recognition states.
- Prefer `TDSessionStrip` for pinned scanner/deal/session totals.
- Use `TDCard` only for hero surfaces, repeated item cards, and framed tools.

## Accessibility Requirements

- Icon-only controls require accessible labels.
- Selectable controls expose selected state.
- Disabled/loading controls expose disabled/busy state.
- Error states expose alert semantics.
- Touch targets are at least 44 px, preferably 48 px.
- Status indicators include text.

## Anti-Patterns

- Raw `Text` and `Pressable` for product UI when a TD primitive exists.
- Nested cards.
- Fake metrics.
- Technical copy in customer states.
- Filter rows that horizontally scroll without clear affordance.
- Multiple dominant primary buttons in one screen section.

## Wave 3 Notes

- Implemented: Admin summary, Settings, Scanner Recovery, and the dev-only design-system showcase now use the shared TD primitive direction without adding new primitive APIs.
- Implemented: `components/admin.tsx` remains a compatibility adapter for active admin routes while rendering through TD-style navigation, row, metric, and badge primitives.
- Deferred With Reason: Dense admin detail routes may continue using legacy admin-specific controls until a dedicated admin management sprint reviews those workflows.
