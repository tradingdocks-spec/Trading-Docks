# Trading Docks Product Design Audit

Status: In progress  
Branch: `codex/product-design-system-redesign`

## North Star

Trading Docks should feel like a TCG intelligence and operations system, not a generic POS dashboard. The interface should help collectors, sellers, stores, and platform operators understand what needs attention, what is worth buying, what should be moved, and what requires operational follow-up.

## Systemic Issues Found

- Repeated glass-card composition appears across unrelated pages, making Collection, Operations, Admin, and beta empty states feel assembled from the same template.
- Multiple active component families exist under `src/components/dashboard`, `src/components/dashboard-v2`, and duplicated common/shared scaffolds. This creates visual drift and makes pages feel like different products.
- Shared scaffolds used glowing background orbs, grid textures, oversized rounded panels, and fake chart frames even when no real data existed.
- Generic status copy such as `Connected workspace` and `Secure cloud sync` appeared in shared headers without proving anything actionable to the user.
- Page headings often use marketing-scale type inside operational workspaces, reducing density and making tables/forms feel secondary.
- Navigation language mixed plan/tier concepts with workflow concepts. Seller and Store users need workflow groups: Collection, Acquire, Sell, Operate, Intelligence.
- Button hierarchy overuses bright blue/cyan styling, so primary actions do not always feel distinct from secondary utilities.
- Border radius and shadow usage are too uniform. Many controls and panels use the same large rounded rectangle shape.
- Empty states sometimes include decorative chart shells or progress bars instead of explaining the next useful action.

## Design-System Direction

- Background: near-black/navy workspace surface with restrained linear light, no decorative orbs.
- Surfaces: use tonal panels and borders before shadows. Reserve stronger panels for page-level briefings.
- Corners: smaller radius for controls, moderate radius for panels, larger radius only for key workspace containers.
- Typography: compact operational hierarchy: kicker, title, body, metadata, numeric value.
- Color: blue is reserved for primary action, focus, and active navigation. Warm accent is reserved for owner/attention context. Semantic green/amber/red are used only for real states.
- Motion: small transitions for menu opening, row hover, and section expansion only.
- Empty states: honest and specific. No fabricated metrics, no fake chart frames, no generic “live” copy before records exist.

## First Checkpoint Changes

- Added global Trading Docks design tokens and utility classes in `src/app/globals.css`.
- Reduced glow, blur, and fake grid intensity in `src/components/dashboard/styles.module.css`.
- Unified duplicated dashboard scaffold paths so common and shared pages resolve to one implementation.
- Replaced the generic scaffold with a compact operational briefing layout and honest empty states.
- Removed generic `Connected workspace` header copy from shared page headers.
- Tightened the dashboard shell, topbar, and sidebar visual treatment.
- Updated sidebar group vocabulary to `Collection`, `Acquire`, `Sell`, `Operate`, `Intelligence`, `Relationships`, and `Utilities`.

## Public Website Redesign Checkpoint

- Replaced the previous public hero pattern of pill headline, plan cards, glowing dashboard preview, and floating status badges with a lifecycle-ledger composition centered on `Identify`, `Value`, `Place`, and `Move`.
- Reworked the homepage hero around the concrete product promise: following every card from scan to sale.
- Replaced the landing pricing section's four giant SaaS cards with a plan progression and compact comparison table: `Organize -> Understand -> Sell -> Operate`.
- Rebuilt the standalone pricing route to use the same workflow-first plan structure while preserving RevenueCat checkout and current-plan behavior.
- Reduced public navigation to lifecycle-oriented anchors and rebuilt the footer as a restrained product index.
- Removed the `Most popular`/glowing featured-card treatment from public pricing. Seller remains recommended through text hierarchy, not neon decoration.
- Rebuilt the remaining homepage sections around Trading Docks-specific operating concepts instead of old generic SaaS section patterns:
  `ExperienceSection` now shows how the same card lifecycle adapts for Collector, Seller, and Store workspaces;
  `FeaturesSection` now explains product authorities and decision outputs;
  `WorkflowExperienceSection` now presents an acquisition-to-analysis trace;
  `EcosystemSection` now distinguishes provider inputs from Trading Docks authority;
  `PlanJourneySection` now mirrors the plan ladder language; and
  `MarketSection` now reads as product/market intelligence instead of a stock-market-style widget.
- Removed repeated icon grids, oversized floating feature cards, decorative gradient treatments, rotating integration orbits, and generic `live simulation` patterns from those remaining homepage sections.
- Kept public demo values tied to the centralized landing sample data so persona metrics, activity, and market context remain internally consistent.

## Remaining Page Priorities

1. Dashboard homepage: convert fully from customizable widget grid into attention-first intelligence briefing.
2. Purchasing Intelligence: sharpen acquisition decision hierarchy around cost, margin, confidence, and recommended action.
3. Inventory and Orders: establish dense table rules, clear bulk action states, and less decorative containment.
4. Collection and Deck Vault: align collector surfaces to the same visual system while preserving visual richness.
5. CRM and Store tools: remove admin-template patterns and make them feel like operating workspaces.
6. Admin: reduce giant section placeholders and make platform controls precise and auditable.
7. Auth and conversion pages: continue tightening signup/signin polish while preserving the proven authentication flow.

## Guardrails

- Do not fabricate business, collection, order, price, or marketplace data.
- Do not change Supabase authorization, membership gates, or data models for visual reasons.
- Do not add competitor-looking dashboard templates.
- Do not collapse every workflow into the same card-grid structure.
