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

## Security and Data

- Required: No secrets committed.
- Required: No broad anonymous data access without explicit review.
- Required: New API routes must declare authentication, authorization, caching, body-size, and provider-verification expectations.
- Required: New Supabase tables must include RLS and staged verification steps.

## Documentation

- Required: Label features as Implemented, Partially Implemented, Planned, or Requires Production Configuration.
- Required: Update `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/AUTHENTICATION.md`, and `docs/SECURITY.md` when behavior changes.
- Required: Keep product claims aligned with active source, not release-note intent.
