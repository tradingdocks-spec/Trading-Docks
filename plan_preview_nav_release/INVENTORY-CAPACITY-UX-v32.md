# Inventory Capacity UX v32

## Location cards

- Equal-height card layout with aligned Open Contents actions
- Two-line location names before truncation
- Type-specific detail such as binder page count or configured storage size
- A reserved capacity area on every card
- Clear Set Capacity and Set Method actions when configuration is incomplete
- Capacity percentage plus used and maximum units
- Consistent available, warning, and critical color states

## Capacity setup

- Capacity remains optional for non-binder locations
- Bulk storage presets: 400, 800, 1,000, 3,200, and 5,000
- Binder capacity is calculated automatically from columns, rows, and pages
- Editable capacity unit, warning threshold, and critical threshold
- Capacity can be added or changed later from Edit Location

## Inventory map

- Sort by name, type, capacity, units, value, or recently added
- Unconfigured filter for missing capacity or organization method
- Summary capacity totals use each location's current saved capacity
- Location category labels and counts remain consistent across the dropdown and filters

## Validation

- Production build and TypeScript validation pass all 54 routes.
