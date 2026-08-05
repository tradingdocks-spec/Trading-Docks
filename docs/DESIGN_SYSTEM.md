# Design System

## Sprint 1.1 Foundation Status

- Implemented: Shared semantic token source lives in `mobile/design/shared-tokens.ts`; `design-system/tokens.ts` re-exports it for root and web imports.
- Implemented: Next.js adapter lives in `src/lib/design-system/tokens.ts`.
- Implemented: Expo adapter lives in `mobile/design/tokens.ts` and preserves the existing `color`, `space`, `radius`, `type`, `motion`, and `elevation` exports for current mobile screens.
- Implemented: First-wave Expo primitives live in `mobile/components/design-system.tsx`.
- Implemented: First-wave Next.js primitives live in `src/components/design-system/td-primitives.tsx`.
- Implemented: Development showcases exist at `mobile/app/dev/design-system.tsx` and `src/app/dev/design-system/page.tsx`; mobile requires `EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE=true`, and web returns 404 in production.
- Partially Implemented: Only the Expo authentication screen, Expo profile surface, and Next dashboard loading surface have migrated to the new primitives.
- Planned: Broad dashboard, navigation, modal, toast, chart, table, and complex form migrations are intentionally deferred.

## Design-System Audit

- Current sources of truth: Web styling previously came from Tailwind class strings, `src/app/globals.css`, `src/components/ui`, CSS modules, and component-local conventions. Mobile styling came from `mobile/design/tokens.ts`, `mobile/constants/brand.ts`, `mobile/components/foundation.tsx`, `mobile/components/primitives.tsx`, themed Expo starter components, and screen-local `StyleSheet` objects. The new shared token source is intentionally inside the Expo project boundary so Metro can bundle it.
- Duplicated visual primitives: Buttons, cards, pills/badges, section headers, loading states, empty states, and input shells are repeated across web dashboards, mobile auth, mobile tabs, admin screens, and backup snapshots.
- Inconsistent colors: The product generally uses dark navy, blue, and cyan, but older web and mobile surfaces mix slate, cyan, amber, emerald, rose/red, violet, and hardcoded alpha colors without a semantic layer.
- Inconsistent spacing: Mobile uses an 8-point-ish scale with `12` as a frequent intermediate value. Web frequently uses Tailwind arbitrary values and one-off compact spacing.
- Inconsistent typography: Web global CSS has later typography repair rules, while many components still use 6-11px arbitrary classes. Mobile uses local `fontWeight: '900'` patterns and screen-specific sizes.
- Inconsistent radii: Web uses `rounded-lg`, `rounded-2xl`, `rounded-[26px]`, `rounded-[30px]`, and larger hero radii. Mobile uses 14, 17, 18, 20, 24, 28, and 34px patterns.
- Inconsistent elevation: Web uses custom box shadows and glows. Mobile previously used iOS `shadow*` and Android `elevation`; the new token adapter uses platform-safe web `boxShadow` where practical.
- Inconsistent motion: Web has global route and landing animations with reduced-motion handling. Mobile press feedback exists in scattered Pressables and haptic wrappers.
- Accessibility gaps: Many bespoke Pressables lack explicit roles/labels, some decorative loading/empty states are not named, and some tiny text is below a comfortable scanning floor.
- Web/native compatibility concerns: React Native Web can warn when deprecated shadow props leak onto web; platform-specific elevation tokens now separate web `boxShadow` from native shadow/elevation. Browser focus states are explicit in TD primitives.
- Recommended migration order: Auth and account surfaces first, then dashboard loading/empty/error states, then common cards and section headers, then input-heavy admin/settings screens, then navigation, tables, modals, toast, and charts in separate sprints.

## Token Naming

Use semantic tokens first:

- `background.primary`, `background.secondary`
- `surface.default`, `surface.elevated`, `surface.floating`, `surface.overlay`
- `text.primary`, `text.secondary`, `text.muted`, `text.inverse`
- `border.default`, `border.strong`, `border.subtle`, `border.focus`
- `action.primary`, `action.primaryHover`, `action.primaryPressed`, `action.secondary`, `action.disabled`
- `state.success`, `state.warning`, `state.danger`, `state.information`, `state.accent`

Raw colors remain available only as palette anchors. New product components should not import raw colors unless defining a new semantic token.

## Component Usage

- Implemented: `TDButton`, `TDCard`, `TDInput`, `TDBadge`, `TDText`, `TDScreen`, `TDSectionHeader`, `TDLoadingState`, `TDEmptyState`, `TDErrorState`, and `TDDivider` exist for Expo and Next.js.
- Implemented: Components include typed props, variants, disabled/loading states where relevant, accessible roles/labels where relevant, web focus styling, and native press feedback.
- Partially Implemented: Existing `Button`, `Card`, and `Badge` in `src/components/ui` remain supported and are not deleted.
- Planned: `TDChart`, `TDModal`, `TDToast`, and `TDNavigation` are deferred to later focused tasks.

## Platform Differences

- Web: CSS variables are defined in `src/app/globals.css`; TD web primitives use Tailwind class strings and focus-visible rings.
- Expo Web: TD mobile primitives use React Native Web-compatible styles, explicit focus outlines, and platform-safe elevation.
- iOS/Android: TD mobile primitives use Pressable feedback and haptics for button presses. Native shadows/elevation are selected by platform.
- Requires Production Configuration: Native accessibility and visual QA still need physical-device validation before release.

## Deprecated Patterns To Avoid

- Avoid new hardcoded product colors in screens when a semantic token exists.
- Avoid viewport-scaled font sizes in compact product controls.
- Avoid adding new deprecated React Native shadow props to web-shared styles.
- Avoid one-off pills, cards, loading spinners, and empty states in new screens.
- Avoid moving every existing screen to the design system in one sweeping refactor.

## Remaining Debt

- Partially Implemented: `mobile/constants/brand.ts` still supplies many legacy mobile screens.
- Partially Implemented: Large web dashboard components still contain hardcoded class strings and bespoke state UI.
- Partially Implemented: Backup directories preserve older visual systems and contribute lint noise.
- Planned: Add visual regression screenshots once the app has stable local seeds and route fixtures.
