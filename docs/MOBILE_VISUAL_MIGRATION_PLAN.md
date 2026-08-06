# Mobile Visual Migration Plan

Status: Implemented as the staged migration plan for Trading Docks mobile polish.

## Goal

Move the active Expo app to the Trading Docks Design Bible without changing authentication, scanner OCR, Scryfall lookup, collection mutations, session persistence, offer math, navigation contracts, membership contracts, Supabase schemas, billing, or offline behavior.

## Phase Order

1. Audit and Design Bible.
2. Component contracts and shared primitives.
3. Mobile shell and bottom navigation polish.
4. Scanner screenshot QA and minor layout refinements.
5. Home redesign.
6. Collection, Card Detail, and Storage redesign.
7. Trade Binder, Wishlist, and Matches workspace.
8. Session Review and Deal Desk redesign.
9. Profile, Settings, Auth, Welcome, Onboarding, and Plans polish.
10. Admin/Command Center mobile polish.

## Review Rules

- Keep each stage reviewable.
- Do not migrate unrelated web surfaces.
- Do not change product behavior while changing presentation.
- Do not introduce fake data to make a screen look full.
- If a real data source is unavailable, show a polished unavailable state.
- Keep route and mutation tests green after each stage.

## Current Branch Scope

Implemented in this branch:

- Mobile product design audit.
- Trading Docks Design Bible.
- Mobile component, accessibility, and motion standards.
- Shared design-system primitives for future migrations.
- Low-risk shell/navigation polish.
- Low-risk customer-facing polish where it can reuse existing data flows.

Deferred:

- Full Deal Desk business workflow redesign.
- Full Binder/Wishlist merge into one segmented exchange workspace.
- Admin/Command Center mobile redesign.
- Physical-device screenshot QA.

## Rollback Strategy

- Component additions are additive and preserve existing APIs.
- Route migrations should keep old data-loading and mutation functions unchanged.
- Revert screen-by-screen if a regression is found.
- Preserve scanner OCR/native-module commits independently from visual changes.

## Verification

After each stage:

- Mobile TypeScript.
- Focused lint for changed files.
- Focused tests for affected routes/services.
- Full mobile tests when shared primitives change.
- Expo Web export.
- Expo config validation.
- `expo install --check`.
- Apple OCR autolinking search and Apple resolve.
- `git diff --check`.
