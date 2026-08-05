# Design System

## Sprint 1.1 Foundation Status

- Implemented: Shared semantic token source lives in `mobile/design/shared-tokens.ts`; `design-system/tokens.ts` re-exports it for root and web imports.
- Implemented: Next.js adapter lives in `src/lib/design-system/tokens.ts`.
- Implemented: Expo adapter lives in `mobile/design/tokens.ts` and preserves the existing `color`, `space`, `radius`, `type`, `motion`, and `elevation` exports for current mobile screens.
- Implemented: First-wave Expo primitives live in `mobile/components/design-system.tsx`.
- Implemented: First-wave Next.js primitives live in `src/components/design-system/td-primitives.tsx`.
- Implemented: The mobile development showcase exists at `mobile/app/dev/design-system.tsx` and requires `EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE=true`.
- Partially Implemented: The web showcase route exists at `src/app/dev/design-system/page.tsx` as a hard 404 so no showcase payload is included in production output. A web showcase can be reintroduced with a local-only delivery pattern in a later task.
- Partially Implemented: Only the Expo authentication screen, Expo profile surface, and Next dashboard loading surface have migrated to the new primitives.
- Partially Implemented: Active mobile tabs and the active web dashboard shell now consume centralized navigation contracts and keep selected/focus states explicit.
- Planned: Broad dashboard, modal, toast, chart, table, and complex form migrations are intentionally deferred.

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

## Canonical Token Ownership

- Canonical owner: `mobile/design/shared-tokens.ts` contains the single `tdTokens` object. It is deliberately inside the active Expo project boundary because Expo Metro cannot bundle arbitrary root files without additional Metro configuration.
- Root endpoint: `design-system/tokens.ts` re-exports the canonical mobile-owned token object for repository-level and future tooling imports.
- Web endpoint: `src/lib/design-system/tokens.ts` re-exports the root endpoint and defines CSS variable names for Next.js components.
- Platform adapters: `mobile/design/tokens.ts` maps canonical tokens into React Native-friendly `color`, `space`, `radius`, `type`, `motion`, `breakpoint`, `icon`, and `elevation` exports. `src/app/globals.css` maps the same semantic values into CSS custom properties.
- Drift rule: token value changes must be made in `mobile/design/shared-tokens.ts` first, then reflected in CSS custom properties in the same change. Do not edit adapter aliases as independent design decisions.
- Known duplication: CSS custom property literal values in `src/app/globals.css` intentionally duplicate the canonical token values until a build-time CSS token generation step exists.

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
- Implemented: The Collector Workspace browser uses TD primitives on web and mobile for cards, inputs, badges, screen layout, loading, empty, no-results, and error states.
- Implemented: The redesigned mobile Home uses the existing TD primitives and shared tokens for header, portfolio card, action buttons, briefing, active-session card, and empty activity state.
- Partially Implemented: Existing `Button`, `Card`, and `Badge` in `src/components/ui` remain supported and are not deleted.
- Planned: `TDChart`, `TDModal`, `TDToast`, and `TDNavigation` are deferred to later focused tasks.

## Navigation Contract Rules

- Implemented: Mobile navigation labels, visibility, prominent tab selection, and fallback account handling live in `mobile/services/navigation-contract.ts`.
- Implemented: Web canonical route labels and implementation status live in `src/lib/navigation/contract.ts`; `src/components/dashboard/navigation.ts` adapts that contract to Lucide icons for the active dashboard shell.
- Implemented: Active navigation items must expose selected state (`aria-current` on web, selected accessibility state on mobile) and visible focus/touch targets.
- Partially Implemented: Navigation contracts are not a substitute for backend authorization. Admin and entitlement-protected routes still need server/RLS enforcement.
- Partially Implemented: Route content can lag behind a canonical label only when documented as Partially Implemented or Planned; do not silently relabel unfinished product screens as complete.
- Planned: A future `TDNavigation` primitive can wrap these contracts once legacy dashboard shells are retired.

## Component Contract Rules

- `TDButton`: Shared variants are `primary`, `secondary`, `ghost`, and `danger`; shared sizes are `sm`, `md`, and `lg`. Mobile is label-first with `iconName`; web accepts `label` or children with an optional icon node. Loading buttons are disabled on both platforms.
- `TDCard`: Shared variants are `default`, `elevated`, `floating`, and `outlined`. Platform elevation implementation may differ.
- `TDInput`: Both platforms support `label`, `error`, and disabled state. Mobile may use icon/accessory props for native layout; web uses regular DOM input attributes and error association.
- `TDBadge`: Shared tones are `neutral`, `success`, `warning`, `danger`, `info`, and `accent`.
- `TDText`: Shared variants are `display`, `heading`, `title`, `body`, `small`, `caption`, and `label`; shared tones are `primary`, `secondary`, `muted`, `success`, `warning`, `danger`, and `info`. Web may choose semantic HTML with `as`; mobile uses React Native `Text`.
- Do not add product-specific copy, navigation behavior, data fetching, billing logic, or auth logic inside TD primitives.

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

## Migration Checklist

1. Confirm the screen already works before changing styling.
2. Replace only one primitive category at a time, starting with states, cards, inputs, or buttons.
3. Preserve route decisions, auth calls, Supabase usage, billing behavior, membership display, and local storage behavior.
4. Use semantic tokens through the platform adapter instead of hardcoded color literals.
5. Keep accessibility roles, labels, error text, disabled state, and loading state equal to or better than the previous screen.
6. Run focused lint, TypeScript, affected tests, and the relevant web export/build before committing.
7. Document any intentional platform difference instead of forcing identical implementation.
8. For navigation migrations, update the route contract first, wire only the active shell, add route/selected-state tests, and document any labels whose destination content is still partially implemented.
9. For collection migrations, use the Collector Workspace models first, display unavailable backend fields honestly, and avoid introducing sample card values into authenticated surfaces.
10. For mobile Home changes, preserve one primary bottom tab navigation system; action rows may deep-link into tabs but must not become a second persistent navigation bar.
