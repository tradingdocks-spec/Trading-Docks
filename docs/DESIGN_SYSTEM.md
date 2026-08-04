# Design System

## Current Web Design System

- Implemented: Tailwind CSS v4 via `src/app/globals.css`.
- Implemented: Core shadcn-style primitives exist in `src/components/ui` for button, badge, and card.
- Implemented: Brand assets exist in `public`, including Trading Docks marks, logo lockups, app icons, favicons, and mana SVG assets.
- Implemented: Web uses lucide-react icons across navigation, buttons, dashboard panels, and product surfaces.
- Implemented: Design typography helpers exist in `src/lib/design-system/typography.ts`.
- Partially Implemented: Visual language is spread across global CSS, module CSS, component-local class strings, and several generations of dashboard components.
- Partially Implemented: The dashboard shell uses a premium dark blue/cyan style, while landing and feature modules use their own effects and CSS modules.

## Current Mobile Design System

- Implemented: Active mobile tokens live in `mobile/design/tokens.ts` and are exported by `mobile/design/index.ts`.
- Implemented: Shared mobile primitives exist in `mobile/components/foundation.tsx`, `mobile/components/primitives.tsx`, themed components, and UI icon helpers.
- Implemented: Mobile uses Trading Docks image assets from `mobile/assets/images`.
- Partially Implemented: Mobile plan colors, account labels, and price points diverge from the web model.
- Partially Implemented: Several screens contain large local `StyleSheet` definitions instead of shared components/tokens.

## Duplication and Drift

- Partially Implemented: `src/components/dashboard` and `src/components/dashboard-v2` overlap for dashboard shell, inventory, purchasing, market intelligence, deck vault, business operations, and workspace components.
- Partially Implemented: Navigation definitions exist in multiple places, including `src/components/dashboard/navigation.ts`, `src/components/dashboard/navigation/navigation.ts`, `src/components/dashboard/navigation/workspaces.ts`, and `src/components/dashboard-v2/navigation.ts`.
- Partially Implemented: Mobile backup directories preserve older component and token systems, adding repo noise.

## Foundation Direction

- Planned: Establish a single source of truth for web tokens, plan colors, component sizing, navigation labels, and workspace states.
- Planned: Decide whether `dashboard-v2` is active, deprecated, or a migration staging area.
- Planned: Align mobile tokens and plan language with web memberships before adding new user-facing screens.
