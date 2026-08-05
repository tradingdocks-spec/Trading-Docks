# Repository Cleanup Plan

## 1. Repository Map

- Active: `src/` is the Next.js web application.
- Active: `mobile/` is the Expo application.
- Active: `supabase/` contains migrations, SQL helpers, and database runbooks.
- Active: `cloudflare/` contains inbound email worker source.
- Active: `design-system/` exposes the shared token re-export used by web and
  mobile adapters.
- Active: `tests/` contains root identity and membership contract tests.
- Active: `.github/workflows/quality.yml` runs root install, check, and build.
- Active: `docs/` contains the current foundation documentation.
- Generated output: `.next/`, `.cache/`, `dist/`, `coverage/`, `mobile/dist/`,
  and `mobile/.expo/` are generated output and should not be treated as source.
- Generated output: `node_modules/` and `node_modules-install-failed/` are
  dependency trees or failed dependency-install artifacts.
- Historical backup: `mobile_backup/`, `mobile-sdk54-clean-backup/`, and
  `mobile-sdk57-backup/` are retained Expo snapshots.
- Safe to archive after review: root release-note Markdown files named with
  version or feature-release suffixes are historical project records, not active
  architecture docs.

## 2. Active Web Application

- Implemented: `src/app` is the active Next.js App Router tree.
- Implemented: `src/app/dashboard/layout.tsx` owns protected dashboard shell
  composition.
- Implemented: `src/lib/supabase` owns active web Supabase SSR/server/client
  helpers.
- Implemented: `src/lib/identity` owns active server-safe access resolution.
- Implemented: `src/lib/membership-catalog.ts` adapts the shared membership
  catalog for web.
- Active but duplicated: Dashboard components span `src/components/dashboard`,
  `src/components/dashboard-v2`, `src/components/ui`, and
  `src/components/design-system`.

## 3. Active Mobile Application

- Implemented: `mobile/app` is the active Expo Router tree.
- Implemented: `mobile/providers` owns active auth, admin, account, profile, and
  session providers.
- Implemented: `mobile/services` owns auth diagnostics, auth routing,
  remembered-email logic, identity/access types, membership catalog, and
  navigation contract.
- Implemented: `mobile/services/storage` owns browser-safe and native storage
  adapters.
- Active but duplicated: `mobile/components/design-system.tsx`,
  `mobile/components/foundation.tsx`, `mobile/components/primitives.tsx`,
  `mobile/components/themed-text.tsx`, and `mobile/components/themed-view.tsx`
  overlap while migration is in progress.

## 4. Active Supabase Infrastructure

- Active: `supabase/migrations` is the migration history for profiles,
  workspaces, roles, subscriptions, inventory, collection/deck features,
  marketplace credentials, and public sharing.
- Active: `src/lib/supabase/server.ts` and related helpers are used in trusted
  web server contexts.
- Active: `src/lib/supabase/client.ts` and `mobile/lib/supabase.ts` are client
  adapters and must use publishable/anon keys only.
- Legacy still referenced: older migrations still include email-owner helper
  functions and `business` membership values. These need proposal-only migration
  work before production changes.

## 5. Backup And Archive Inventory

| Path | Classification | Evidence | Recommendation |
| --- | --- | --- | --- |
| `mobile_backup/` | Historical backup | Not referenced by active source, scripts, Supabase, Cloudflare, or GitHub quality workflow; contains 38,782 files on disk | Archive outside the active repository after review |
| `mobile-sdk54-clean-backup/` | Historical backup | Not referenced by active source, scripts, Supabase, Cloudflare, or GitHub quality workflow; 42 files on disk | Archive outside the active repository after review |
| `mobile-sdk57-backup/` | Historical backup | Not referenced by active source, scripts, Supabase, Cloudflare, or GitHub quality workflow; 33,845 files on disk | Archive outside the active repository after review |
| `node_modules-install-failed/` | Generated output | Failed dependency tree artifact; not referenced by active source or scripts; 3,000 files on disk | Safe to delete after review |
| Root `V###*.md` and `*-v###.md` files | Safe to archive after review | Historical release/change notes are separate from active docs in `docs/` | Move to external archive or `docs/archive` after review |
| `.next/`, `.cache/`, `mobile/dist/`, `mobile/.expo/` | Generated output | Build/export/cache output | Keep ignored and disposable |

## 6. Duplicate Component Inventory

- Active but duplicated: `src/components/dashboard` and
  `src/components/dashboard-v2` both contain dashboard workspace components.
  Active route imports still use both, so neither tree should be removed yet.
- Active but duplicated: `src/components/dashboard/common`,
  `src/components/dashboard/layout`, `src/components/dashboard/shell`, and
  `src/components/dashboard/workspace` overlap as shell/scaffold layers.
- Active but duplicated: `src/components/ui` and
  `src/components/design-system/td-primitives.tsx` overlap for buttons, badges,
  cards, inputs, and utility styling.
- Active but duplicated: mobile primitive files overlap with the new mobile TD
  primitives and older Expo template components.
- Unknown and requires product-owner confirmation: whether every dashboard
  workspace surfaced by older release notes remains in current product scope.

## 7. Duplicate Service Inventory

- Active: `src/lib/identity` and `mobile/services/access-model.ts` intentionally
  separate server authority from mobile UX caching.
- Active: `src/lib/membership-catalog.ts` and
  `mobile/services/membership-catalog.ts` intentionally separate provider-safe
  web adaptation from the canonical shared catalog.
- Active but duplicated: Supabase helpers exist for web client, web server,
  proxy middleware, mobile client, and admin/service-role contexts. They are
  valid only while environment boundaries remain explicit.
- Legacy still referenced: root SQL snippets such as `00_RUN_THIS_IN_SUPABASE/`
  may duplicate migration history and should be reviewed against
  `supabase/migrations` before removal.

## 8. Duplicate Navigation Inventory

- Active: `mobile/services/navigation-contract.ts` drives active mobile tab
  labels.
- Active: `src/lib/navigation/contract.ts` drives active web dashboard labels.
- Active but duplicated: `src/components/dashboard/navigation.ts` adapts icons
  and labels for the active shell.
- Legacy still referenced: `src/components/dashboard/navigation/navigation.ts`
  and `src/components/dashboard/navigation/workspaces.ts` are still imported by
  older dashboard layout components.
- Safe to archive after review: older sidebars/topbars can be removed only after
  route imports and screenshots confirm the active shell owns all dashboard
  navigation.

## 9. Duplicate Design-System Inventory

- Active: `mobile/design/shared-tokens.ts` is the canonical token source.
- Active: `design-system/tokens.ts`, `src/lib/design-system/tokens.ts`, and
  `mobile/design/tokens.ts` are platform adapters.
- Active but duplicated: legacy token/color files in mobile and local CSS
  literals in older web workspaces remain until screen migration.
- Planned: Continue migrating existing screens to TD primitives incrementally;
  do not migrate additional screens during repository cleanup.

## 10. Unused Dependency Candidates

- Unknown and requires import audit: root dependencies should not be removed in
  this sprint. `class-variance-authority`, `radix-ui`, and `tailwind-merge` are
  actively imported by web UI helpers.
- Unknown and requires import audit: `next-themes`, `motion`, `tw-animate-css`,
  and `shadcn` appear in `package.json` but need a deeper dependency and config
  usage audit before removal.
- Active: mobile dependencies checked in this audit include direct usage of
  `expo-haptics`, `expo-image`, `expo-symbols`, `expo-local-authentication`,
  and `expo-secure-store`.
- Safe to delete after review: `node_modules-install-failed/` is not a
  dependency declaration and should not remain in source control or active
  searches.

## 11. Unused Route Candidates

- Unknown and requires product-owner confirmation:
  `src/app/dashboard/mission-control-preview` appears to be a preview route.
- Unknown and requires product-owner confirmation: planned dashboard routes such
  as automation, finances, organization, payroll, vendors, supplies, and
  tournament surfaces need route-by-route product status review.
- Implemented but gated: `src/app/dev/design-system` is a development-only
  showcase and should remain inaccessible in production.
- Implemented but gated: `mobile/app/dev` is a development-only showcase and
  should remain unavailable without the explicit development flag.
- Active: auth, onboarding, pricing, public share, and dashboard routes are part
  of the current route surface.

## 12. Lint And TypeScript Noise Sources

- Implemented: root TypeScript already scopes source to root TS files, `src/`,
  and Next generated types.
- Implemented: active mobile TypeScript scopes to files under `mobile/`.
- Partially Implemented: root ESLint previously traversed historical Expo
  backups and `node_modules-install-failed`, creating avoidable noise.
- Implemented: this audit excludes confirmed backup/archive and generated output
  folders from root ESLint scope.
- Partially Implemented: repo-wide lint still fails on active source debt after
  the safe exclusions. That remediation should remain a dedicated stabilization
  task.

## 13. Recommended Cleanup Phases

1. Freeze backup folders by policy and keep them excluded from active tooling.
2. Move or remove generated dependency/build artifacts after review.
3. Archive root historical release notes after product-owner confirmation.
4. Run an import audit for dashboard shells, sidebars, navigation definitions,
   and workspace generations.
5. Pick one canonical dashboard shell and migrate active routes in small PRs.
6. Review root SQL snippets against Supabase migrations and convert anything
   still needed into documented migration proposals.
7. Run dependency usage checks and remove only confirmed unused packages.
8. Add CI jobs for mobile typecheck, mobile tests, Expo web export, and focused
   route/access tests.

## 14. Risk Level For Each Proposed Cleanup

- Low: Ignore generated output in lint/gitignore.
- Low: Add README markers to historical backup folders.
- Low: Delete local generated output after review.
- Medium: Move root historical release notes into an archive path.
- Medium: Remove `node_modules-install-failed/` from source control after review.
- Medium: Retire duplicate mobile primitive files after screens are migrated.
- High: Delete dashboard component generations before import ownership is
  audited.
- High: Rewrite Supabase migrations or SQL helpers without staging replay.
- High: Remove dependencies without checking imports, config references, and
  package-lock impact.

## 15. Rollback Strategy

- Use a dedicated `codex/*` branch for every cleanup phase.
- Keep deletions in separate commits from config or documentation changes.
- Before removing a folder, record `git ls-files <path>` and active import
  results in the PR.
- If a cleanup breaks build, restore only the affected path or config from the
  previous commit and rerun the same validation set.
- Do not use destructive git commands to roll back unrelated user changes.

## 16. Verification Steps After Cleanup

- Run `git diff --check`.
- Run root TypeScript with `npm.cmd run typecheck`.
- Run active mobile TypeScript from `mobile/`.
- Run focused lint for changed source/config files.
- Run identity and membership tests.
- Run existing mobile tests.
- Run Expo web export when mobile paths or Expo config are affected.
- Run Next.js build.
- Run repo-wide lint and record whether failures decreased, stayed the same, or
  moved to active source.
- Confirm no production code, database schemas, environment variables, billing,
  authentication, memberships, navigation behavior, or deployment settings were
  changed unless explicitly in scope.
