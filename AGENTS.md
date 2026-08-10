# Trading Docks OS Engineering Guide

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Current Foundation Rules

- Do not work directly on `main`; use a focused `codex/*` branch.
- Do not add production product features until the foundation docs and review gates are accepted.
- Do not change Supabase schemas, environment variables, secrets, or deployment settings without explicit approval.
- Treat `src/` as the active Next.js web app and `mobile/` as the active Expo app.
- Treat `mobile_backup/`, `mobile-sdk54-clean-backup/`, and `mobile-sdk57-backup/` as historical snapshots unless a task explicitly targets them.
- Before runtime code changes, run the relevant checks from `package.json` and, when mobile is affected, the active mobile checks from `mobile/package.json`.
- Keep documentation honest: label features as Implemented, Partially Implemented, Planned, or Requires Production Configuration.
