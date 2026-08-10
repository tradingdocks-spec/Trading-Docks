# Trading Docks Label Studio Product

## Current Status

- Implemented: A shared Label Studio contract exists in `src/lib/label-studio/label-templates.ts`.
- Implemented: Headquarters exposes `/dashboard/label-studio` as the centralized Operations Label Studio workspace.
- Implemented: Initial label categories are Card Show, Single, Showcase, Sealed, Storage, Buylist / Intake, and Custom.
- Implemented: Initial label size presets are `1 x .5`, `1 x 1`, `1.5 x 1`, `2 x 1`, `2.25 x 1.25`, `2 x 2`, `3 x 2`, `4 x 2`, and Custom.
- Implemented: Dynamic bindings cover card, inventory, sealed product, and workspace fields.
- Implemented: Pricing rules preview market percentage, fixed markup, minimum price, nearest-dollar, and `.99` rounding behavior without overwriting inventory prices.
- Partially Implemented: Bulk label rendering and pagination are wired for browser printing, but physical label-stock QA is still required.
- Partially Implemented: Persistent template CRUD, inventory label identities, print-job audit records, and repricing review are wired to the staging-applied schema. Production rollout still requires explicit approval and environment verification.
- Implemented: The public `/q/{token}` route resolves through the sanitized Supabase QR resolver and does not expose private inventory fields.
- Planned: Drag-and-drop template editing, printer SDKs, native mobile printing, and vendor-specific printer adapters are future work.
- Requires Production Configuration: Browser printing should be validated against real label stock and store printers before production rollout.

## Product Model

Label Studio is a workspace capability, not a disconnected QR utility. Labels attach to durable Trading Docks inventory identity so the same code path can serve:

- singles
- card shows
- sealed products
- showcases
- storage inventory
- POS
- inventory audits

## Navigation And Entry Points

- Implemented: Label Studio belongs under the existing Operations navigation section, not Selling.
- Implemented: Operations exposes one entry: `Operations` -> `Label Studio`.
- Implemented: The one canonical route is `/dashboard/label-studio`.
- Implemented: Visibility uses the shared `label.view` capability.
- Implemented: Contextual launch points deep-link into the same canonical Label Studio route:
  - Inventory: select inventory -> Print Labels -> Label Studio.
  - Card Shows: Print Show Labels -> Label Studio.
  - Sealed Inventory: select products -> Print Labels -> Label Studio.
  - Future POS: item -> Print/Reprint Label -> Label Studio.
- Implemented: Do not create separate label builders for Inventory, Card Shows, Sealed Inventory, or POS.
- Implemented: Label Studio remains the centralized operational workspace for singles labels, sealed product labels, card show price labels, QR labels, barcode labels, custom label sizes, bulk printing, repricing/reprinting, inventory SKU identity, and future POS labels.

## Template Fields

Implemented bindings:

- `card.name`
- `card.set`
- `card.collector_number`
- `inventory.condition`
- `inventory.finish`
- `inventory.asking_price`
- `inventory.market_price`
- `inventory.sku`
- `inventory.location`
- `sealed.product_name`
- `workspace.name`

## Pricing Rules

- Implemented: Rules calculate proposed prices from current market or asking price inputs.
- Implemented: Proposed repricing is reported separately from current inventory values.
- Implemented: Inventory price writeback requires explicit user approval and server-side `inventory.reprice` authorization.

## Permissions

- Implemented: `label.view`, `label.manage_templates`, `label.print`, `inventory.reprice`, and `pos.sell` are registered in shared platform access.
- Implemented: Seller and Store workspaces can view Label Studio; template management and repricing require higher workspace roles.
- Partially Implemented: Permission boundaries use shared capabilities and Supabase RLS; production rollout still needs store-role browser QA.

## Browser Printing

- Implemented: Label render results carry normalized physical dimensions for CSS-ready output.
- Implemented: Browser printing opens from Label Studio and records `label_print_jobs` audit metadata without storing rendered HTML or images.
- Requires Production Configuration: Validate print CSS on representative `2 x 1`, `3 x 2`, and `4 x 2` stock before production use.
