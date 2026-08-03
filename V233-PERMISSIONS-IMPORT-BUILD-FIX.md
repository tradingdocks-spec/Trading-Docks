# Trading Docks v233 — Permissions import build fix

The v231 permissions audit inserted entitlement imports inside an existing multi-line import declaration in `src/app/api/multi-game-market/route.ts`.

This release moves those imports to valid top-level import statements and scans all TypeScript files for the same malformed nested-import pattern.

The v232 landing-page pricing redesign and v231 account-permission matrix remain included.
