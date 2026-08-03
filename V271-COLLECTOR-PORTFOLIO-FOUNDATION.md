# Trading Docks v271 — Collector Portfolio Foundation

## New top-level product

Collector Portfolio now appears in Core navigation and includes:

- Portfolio Home
- Digital Bookshelf
- Showcase Studio
- Trade Center foundation
- Collection Highlights
- Portfolio Settings

## Portfolio presentation

- Custom binder titles, descriptions, cover colors, and accent colors
- Featured binder
- Public, unlisted, and private binder visibility
- Trade-binder mode
- Premium binder-cover presentation
- Portfolio totals and value presentation

## Sharing scopes

- Current page
- Full binder spread
- Entire binder
- Full portfolio

Share links use sanitized snapshots and never expose purchase price, cost basis,
private notes, credentials, customer information, or internal inventory history.

## Public routes

- `/collectors/[username]`
- `/collectors/[username]/[binderSlug]`
- `/share/portfolio/[token]`

## Required migration

Run:

`supabase/migrations/202608030040_collector_portfolio_foundation.sql`

The earlier binder-share migration can remain in place.

## Scope of this release

This is the launch-quality foundation. The schema also prepares for later
phases: trade requests, featured-card stories, portfolio analytics, QR codes,
Instagram carousel background jobs, and collection milestones.
