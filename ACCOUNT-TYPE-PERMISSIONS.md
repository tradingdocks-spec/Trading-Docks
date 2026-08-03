# Trading Docks account permissions

This file is the product-level permission decision for Free, Collector, Seller,
and Store. The code source of truth is `src/lib/tier-access.ts`.

## Free

Designed for trying the platform and maintaining a small personal collection.

Included:
- Dashboard
- Inventory: 500 units
- Deck Vault: 10 decks
- Plan management
- Settings
- Feedback and support

Not included:
- Collection analytics
- CSV Conversion Engine
- Purchasing
- CRM
- Marketplace integrations
- Orders
- Automation
- Store operations

## Collector

Designed for serious personal collection management.

Everything in Free, plus:
- Inventory: 10,000 units
- Deck Vault: 50 decks
- Collection analytics
- Collection value and growth reporting
- CSV Conversion Engine
- CSV import/export workflows

Not included:
- Purchasing and buylist operations
- Customer CRM
- Selling and marketplaces
- Orders and fulfillment
- Store operations

## Seller

Designed for a single-user online card business.

Everything in Collector, plus:
- Inventory: 50,000 units
- Unlimited decks
- Purchasing Intelligence
- Collection, sealed, and bulk buying
- Purchase history and buying rules
- AI buying recommendations
- Buylist Intelligence and connections
- Customer CRM, store credit, and loyalty records
- Sell Optimizer
- Marketplace integrations
- Orders and fulfillment
- Card Shows
- Seller automation

Not included:
- Business Intelligence
- Employees and payroll
- Vendors and supply orders
- Store calendar, tasks, tournaments, finances, or organization controls

## Store

Designed for a storefront or multi-person operation.

Everything in Seller, plus:
- Inventory: 250,000 units
- Business Intelligence
- Tasks
- Business calendar
- Tournaments
- Vendors
- Supply orders
- Employees
- Payroll
- Finances
- Organization controls
- Five team seats included

## Security behavior

- Page routes are guarded by `PlanAccessGate`.
- Navigation displays the required plan for inaccessible links.
- Sensitive seller and Store APIs perform server-side entitlement checks.
- Unknown future dashboard routes fail closed to Store access until classified.
- Admin Control Center still requires owner authorization in addition to Store
  plan access.
