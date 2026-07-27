# Trading Docks Admin Control Center — v38

## Placement

The Admin Control Center is available only to `tradingdocks@gmail.com`.
Its owner-only entry appears directly above the account card at the bottom of
the dashboard sidebar. This keeps administrative controls reachable throughout
the website without mixing them into everyday collection and business modules.

## Included

- Permanent Owner / Super Admin recognition for `tradingdocks@gmail.com`
- Server-side owner check for `/dashboard/admin`
- Owner-only sidebar link and shield badge
- Google Authenticator-compatible TOTP enrollment and verification
- QR-code setup and manual secret fallback
- AAL2 verification before the control center opens
- Responsive Admin Control Center with:
  - Overview
  - Users
  - Plans & Limits
  - Feature Access
  - Categories
  - Security
  - Audit Log
- Editable feature visibility and minimum-plan rules
- Visible, Coming Soon, and Hidden feature states
- Free, Collector, Seller, and Business plan foundation
- User access override and audit-log database foundation
- Database protection against demoting or removing the permanent Owner

## Required database update

After replacing the project, apply:

`supabase/migrations/202607260002_admin_control_center.sql`

in the Supabase SQL Editor. The existing authentication migration must be
applied first.

## Authenticator setup

1. Sign in as `tradingdocks@gmail.com`.
2. Select **Admin Control Center** at the bottom of the sidebar.
3. Select **Set up authenticator**.
4. Scan the QR code with Google Authenticator or another TOTP app.
5. Enter the current six-digit code.

The authenticator code supplements the signed-in Owner session; it never
replaces the account login.
