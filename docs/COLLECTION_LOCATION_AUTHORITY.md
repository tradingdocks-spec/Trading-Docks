# Collection Location Authority

Status: Core Product Requirement

Trading Docks must treat physical location as a first-class part of the Collection model. The central user promise is:

> A user can search any card they own and immediately see exactly where every physical copy is stored.

This is not optional inventory metadata. It is a core Collection, CSV import, Storage, Trade Binder, and Card Workspace behavior.

## Product Contract

For every owned card result shown in Global Search, Collection search, Card Workspace, Inventory search, CSV review, or Storage browsing, Trading Docks should expose the physical location evidence for the underlying inventory lots.

Example:

```text
Lightning Greaves
Commander Masters
4 owned

Locations
2 - Storage / Bulk Box One / Uncommons
1 - Binders / Trade Binder
1 - Decks / Krenko
```

The UI must not flatten separate physical lots into one misleading location. Aggregate ownership answers "how many do I own?" while lot/location breakdown answers "where are the copies?"

## Multi-Location Ownership

A single printing may exist in multiple physical locations. Trading Docks should model and render that explicitly.

Example:

```text
4 owned

NM / Nonfoil / Qty 2 / Storage / Bulk Box One
NM / Nonfoil / Qty 1 / Binders / Trade Binder
LP / Foil / Qty 1 / Binders / Personal Binder / Page 4
```

Search, Collection rows, Card Workspace, and Storage views should use the same lot data. Portfolio totals continue to include every owned copy across all lots.

## Location Paths

Location paths must be human-readable breadcrumbs. Examples:

- `Storage / Bulk Box One`
- `Storage / Bulk Box One / Uncommons`
- `Binders / Trade Binder`
- `Binders / Personal Binder / Page 4`
- `Storage / High Value Box / Row B`

If nested locations are available, path construction should be implemented once and reused across Collection, Storage, Card Workspace, CSV import review, and search.

## CSV As Physical Digitization

CSV import should support location-first digitization:

1. The user creates or selects a physical location.
2. The user uploads the CSV representing what is physically inside that location.
3. Trading Docks resolves card identity and exact printing.
4. The user verifies condition and finish.
5. The user resolves ambiguous printings.
6. Approved rows inherit the selected destination unless individually overridden.
7. Finalization creates inventory lots tied to that physical location.
8. Those cards immediately become searchable by location.

Location-first entry point:

```text
Storage
Bulk Box One
Uncommons
Import CSV into this location
```

Global entry point:

```text
Collection
Import CSV
Select destination during review
```

Both flows must create the same canonical inventory lots.

## Search And Filtering

Collection and inventory search should support:

- Card name, set, collector number, and exact printing.
- Location name.
- Parent location.
- Nested child location.
- Location type.
- Unassigned or needs-location state.

Searching `Bulk Box One` should find inventory in `Bulk Box One / Commons` and `Bulk Box One / Uncommons` when hierarchy is enabled.

Search must remain server-filtered and indexed enough for 100-card collectors, 5,000-card sellers, and 100,000-card stores. It must not require loading a full inventory into the browser.

## Card Workspace

Card Workspace should include a prominent `Stored in` section.

For one lot, show the location path directly. For multiple lots, show a summary such as `Stored in 3 locations`, then list each location with quantity, condition, and finish. Each location should link to the corresponding Storage, Binder, Trade Binder, or Deck view when that destination exists.

## Move Semantics

Collection and Card Workspace move actions must support whole-lot and partial-quantity moves.

Example:

```text
Qty 8 in Storage / Bulk Box One
Move 3 to Binders / Trade Binder

Result
Storage / Bulk Box One: 5
Binders / Trade Binder: 3
```

The movement ledger should record the physical movement truthfully. Moving a partial quantity should split or adjust lots rather than moving every copy unless the user explicitly selected the whole lot.

## Trade Binder Semantics

Trade Binder is a specialized physical location, not a separate ownership universe.

Cards assigned to Trade Binder should:

- Show in Trade Binder.
- Expose location as Trade Binder.
- Remain part of Portfolio/global ownership.
- Avoid cluttering default loose inventory views when the product view is location-focused.

## Unassigned Inventory

Unassigned cards must be easy to find and clean up through `Unassigned`, `Needs location`, or Inventory Inbox workflows.

Unassigned is a smart location and an operational task list. Seller and Store users should be able to resolve unlocated inventory without guessing which records are missing physical truth.

## Future Location Identifiers

The model should remain compatible with durable location identity such as printed labels or QR codes.

Future example:

```text
Scan QR on Bulk Box One
Open Storage / Bulk Box One in Trading Docks
```

This checkpoint does not require QR implementation, but future QR/location identity must not be blocked by ad hoc location strings.

## Success Criteria

This capability is successful when:

1. A user creates `Storage / Bulk Box One / Uncommons`.
2. The user uploads a CSV of the cards physically inside it.
3. The user verifies condition and finish.
4. The user finalizes the import.
5. The user searches one of those cards by name.
6. Trading Docks shows `Bulk Box One / Uncommons`.
7. The user moves one copy into Trade Binder.
8. Search shows both locations and quantities correctly.
9. Portfolio still counts all owned copies.
10. Default Inventory no longer presents those cards as one generic pool.

