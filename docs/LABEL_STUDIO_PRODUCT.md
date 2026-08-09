# Trading Docks Label Studio Product

## Current Status

- Implemented: A shared Label Studio contract exists in `src/lib/label-studio/label-templates.ts`.
- Implemented: Headquarters exposes `/dashboard/label-studio` as a foundation preview using structured template controls and accurate physical-size metadata.
- Implemented: Initial label categories are Card Show, Single, Showcase, Sealed, Storage, Buylist / Intake, and Custom.
- Implemented: Initial label size presets are `1 x .5`, `1 x 1`, `1.5 x 1`, `2 x 1`, `2.25 x 1.25`, `2 x 2`, `3 x 2`, `4 x 2`, and Custom.
- Implemented: Dynamic bindings cover card, inventory, sealed product, and workspace fields.
- Implemented: Pricing rules preview market percentage, fixed markup, minimum price, nearest-dollar, and `.99` rounding behavior without overwriting inventory prices.
- Partially Implemented: Bulk label rendering and pagination are pure contracts and preview UI only.
- Planned: Persistent template CRUD requires the migration described in `docs/INVENTORY_QR_ARCHITECTURE.md`.
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
- Planned: Inventory writeback must require explicit user approval and server-side authorization.

## Permissions

- Implemented: `label.view`, `label.manage_templates`, `label.print`, `inventory.reprice`, and `pos.sell` are registered in shared platform access.
- Implemented: Seller and Store workspaces can view Label Studio; template management and repricing require higher workspace roles.
- Planned: Final permission boundaries should be reviewed with store roles before migration rollout.

## Browser Printing

- Implemented: Label render results carry normalized physical dimensions for CSS/PDF-ready output.
- Partially Implemented: The current Headquarters page previews one label and bulk pagination but does not yet open a print job.
- Planned: Add print CSS with page-size rules after real label stock is selected.
