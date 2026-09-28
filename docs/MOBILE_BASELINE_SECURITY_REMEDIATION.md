# Separate follow-up: mobile baseline dependency security debt

Status: **Planned — open, unassigned; not part of Chaos promotion implementation.**

Baseline `origin/main`: `13766d473d72451dd164b5ae1ce4baa69ce94f19`, reviewed September 27, 2026. npm audit reports 6 high / 19 moderate / 0 critical entries both with and without development dependencies. See `CHAOS_DEPENDENCY_SECURITY_DELTA.md` and its JSON evidence for exact versions, advisories and paths.

Scope: triage and remediate the existing mobile Expo dependency graph on a separate focused branch/PR. Prioritize runtime `decode-uri-component`/query-string deep-link parsing and nanoid call-site conditions, then development-client AJV/fast-uri and XML, YAML, Metro image and CSS toolchains. Do not assume that production dependency classification means every vulnerable tool executes on end-user devices. Do not assume build-time vulnerabilities are harmless.

Acceptance:

- Reproduce current locked audits and document reachable inputs for each advisory.
- Select compatible targeted upgrades or a separately reviewed Expo upgrade; do not run `npm audit fix --force` blindly.
- Verify mobile navigation/deep links, camera/scanning, authentication and native/web build compatibility; rerun mobile tests, TypeScript, lint and release checks.
- Record residual findings and mitigations explicitly, with a fresh before/after audit.
- Preserve root web/POS/Chaos behavior; no production database or deployment changes are authorized by this record.

This record tracks debt; it does not mark advisories fixed, alter the audit exit code, or waive security checks for future unrelated changes. The owner specifically authorized excluding unchanged debt from the Chaos promotion regression gate.
