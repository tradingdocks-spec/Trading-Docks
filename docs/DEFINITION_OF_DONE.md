# Definition of Done

## Code Changes

- Implemented: Use TypeScript and existing project patterns.
- Implemented: Preserve the Next.js 16 App Router conventions documented in local `node_modules/next/dist/docs`.
- Required: Do not change schemas, secrets, environment variables, or deployments unless the task explicitly asks for it.
- Required: Do not add new product surfaces without updating navigation, access control, data model docs, and validation notes.

## Validation

- Required: Run `npm run typecheck` for root web TypeScript changes.
- Required: Run `npm run lint` for root web source changes.
- Required: Run `npm run build` when changes affect Next routes, config, auth, billing, API handlers, or shared runtime code.
- Required: Run mobile validation from `mobile/package.json` when changing mobile code.
- Required: Report any validation that is unavailable, skipped, or blocked.

## Mobile Product Design

- Required: Preserve auth, session, Supabase, scanner recognition/OCR, billing, membership, navigation, and offline behavior unless the task explicitly changes them.
- Required: Use the mobile design OS docs for new or migrated mobile screens: `docs/TRADING_DOCKS_DESIGN_BIBLE.md`, `docs/MOBILE_COMPONENT_CONTRACTS.md`, `docs/MOBILE_ACCESSIBILITY_STANDARD.md`, and `docs/MOBILE_MOTION_STANDARD.md`.
- Required: Do not show fake prices, fake margins, fake collection values, fake activity, fake events, or invented metrics in authenticated mobile surfaces.
- Required: Keep one primary mobile bottom navigation system, respect safe-area insets, and ensure scroll content is not hidden behind the bar.
- Required: Icon-only controls need labels, visible focus on Expo Web, disabled/loading state when relevant, and minimum touch targets.
- Required: Motion must be restrained, purposeful, and safe under reduced-motion preferences.
- Required: Manual QA notes must call out untested native behavior, including small phone, large phone, Android, tablet, larger text, reduced motion, and physical camera/OCR paths when affected.

## Security and Data

- Required: No secrets committed.
- Required: No broad anonymous data access without explicit review.
- Required: New API routes must declare authentication, authorization, caching, body-size, and provider-verification expectations.
- Required: New Supabase tables must include RLS and staged verification steps.

## Documentation

- Required: Label features as Implemented, Partially Implemented, Planned, or Requires Production Configuration.
- Required: Update `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/AUTHENTICATION.md`, and `docs/SECURITY.md` when behavior changes.
- Required: Keep product claims aligned with active source, not release-note intent.

## Mobile Release QA

- Implemented: Mobile Design OS work now requires the `docs/MOBILE_RELEASE_QA.md` checklist before release sign-off.
- Requires Production Configuration: Physical-device VoiceOver, TalkBack, camera, OCR, large-text, reduced-motion, and safe-area QA must be completed or explicitly waived by product ownership.
- Implemented: Source tests should guard no fake metrics, no normal-user technical scanner recovery details, dev-only showcase gating, and canonical Design OS route usage where practical.
