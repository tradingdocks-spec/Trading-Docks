TRADING DOCKS — PURCHASING CENTER

SIDEBAR REORGANIZATION

Core Workspace now displays:

Dashboard
Inventory
Purchasing
  Collection Buying
  Sealed Product Buying
  Bulk Buying
  Purchase History
  Buying Rules
  AI Recommendations
Marketplaces
Orders
Analytics
Automation

Collection Buying and Sealed Product Buying remain fully separate pages and
workflows, but are grouped under a collapsible Purchasing department.

NEW ROUTES

/dashboard/purchasing
/dashboard/collection-buying
/dashboard/sealed-buying
/dashboard/bulk-buying
/dashboard/purchase-history
/dashboard/buying-rules
/dashboard/buying-recommendations

PURCHASING OVERVIEW

Includes:
- Purchases today
- Pending appraisals
- Available purchase budget
- Purchase-history totals
- Direct links to Collection, Sealed, and Bulk buying
- Buying intelligence
- Quick links to history, rules, and recommendations

SEALED PRODUCT BUYING

Includes:
- Product search
- UPC scanning placeholder
- Magic, Pokémon, Lorcana, and One Piece sealed products
- Quantity controls
- Packaging-condition adjustments
- Market value
- Cash offer
- Store-credit offer
- Current inventory awareness
- Sales velocity
- Reprint risk
- Configurable cash percentage and store-credit bonus
- Purchase and intake action

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev

The Collection Buying Center remains at its existing route and was not merged
with the Sealed Product Buying workspace.
