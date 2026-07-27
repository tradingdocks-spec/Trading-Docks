# Trading Docks v39 — Trials & Admin Roadmap

## Added now

- Owner-only Trials & Promotions workspace
- Grant a Collector, Seller, or Business trial by email
- Custom expiration date and private administrative notes
- Pending access automatically attaches when the matching email creates or opens an account
- Trial status, activation, expiration, last activity, and usage-event counters
- Search and status filtering
- Extend a trial by seven days
- Mark a trial converted
- Revoke trial access
- Trial and usage tables protected by row-level security
- Generic usage-recording database function for feature modules

## Recommended next admin modules

1. **Customer support:** impersonation with consent, account diagnostics, password-reset assistance, and support notes.
2. **Billing:** subscription history, failed payments, coupons, refunds, credits, and invoices.
3. **Communications:** maintenance banners, product announcements, onboarding campaigns, and trial-expiration reminders.
4. **System health:** database/storage usage, failed jobs, integrations, email delivery, and API-rate monitoring.
5. **Data controls:** customer exports, account deletion requests, backups, restore points, and retention rules.
6. **Security:** suspicious sign-ins, locked accounts, MFA status, active sessions, and emergency access revocation.
7. **Analytics:** activation funnel, trial-to-paid conversion, retention, feature adoption, and account-level usage.
8. **Operations:** support queue, bug reports, feature requests, changelog, and controlled beta cohorts.

## Email delivery note

The trial record is ready before the customer has an account and will attach by email after signup. Sending a branded invitation email should be connected to a transactional email provider or a protected Supabase server function; a privileged service key must never be exposed in browser code.
