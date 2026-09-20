# Labels and barcodes — Phase 2

Status: **Implemented and locally validated for development**; physical hardware acceptance is outstanding. No production rollout or migration is authorized.

## Audit before implementation

The canonical route is `/dashboard/label-studio`, backed by `LabelStudioWorkspace`, `/api/label-studio`, and the existing `inventory_label_identities`, `label_templates`, `label_print_jobs`, and `inventory_price_reviews` tables. Inventory bulk selection already passes bounded IDs through `labelStudioHref`; the API resolves them in the active workspace. It currently selects the most recent 24 items without search. It does not carry position IDs or committed Chaos Sort selections.

The existing barcode component draws a fixed decorative pattern unrelated to its payload. It is not a barcode encoder. QR uses `qrcode`. Template elements use normalized coordinates, but barcode/QR switches do not consistently control rendering. The print CSS hides dashboard descendants with `visibility:hidden`, leaving layout space; it has no physical `@page` size, guesses 12/6/2 labels per page from raw dimensions without converting units, and forces a break after the last page. The print button recursively retries identity resolution using stale state. Print jobs are marked printed before a dialog opens. These are sources of blank, excess, and unreadable labels.

Existing identities are opaque `TD-XXXX-XXXX` SKUs with separate public QR tokens, one active identity per inventory item. The optional barcode field can instead contain an external UPC. Phase 1 ORs all lookup sources together and returns item-level DTOs, even for multiple positions. Its cart combines lines by item ID. Exact position checkout already exists, but duplicate item lines are rejected. Consequently the existing label path cannot reliably identify an individual batch position.

Chaos Sort batch labels already have a separate, isolated route with physical dimensions and browser PDF regressions. Preserve that batch-label path. New inventory-label actions must resolve committed positions, not recognition candidates. Existing inventory ownership is per user even inside a workspace; label generation and POS must retain it.

## Identity decision

Extend `inventory_label_identities`; retain every existing SKU and QR token. Add an optional position binding for singles. Item-level identities remain valid for legacy labels and generic merchandise. Several physical copies in one quantity-based position share one barcode; no fictional copy-level identities. The barcode contains only the opaque SKU, never price, quantity, or metadata. Corrections follow the same canonical item/position; deletion does not infer a replacement. Repricing, notes, batch names, and permitted moves do not regenerate codes.

Lookup precedence is internal SKU/QR, explicit store alias, UPC/EAN, then legacy product/provider identifiers. Ambiguity must fail closed. Inactive and wrong-class labels cannot reach checkout. Knowing a code grants no authorization. New alias writes require management permission and retain their original target.

## Printing design

Keep Label Studio as the single editor and queue. Share one deterministic renderer between preview and isolated output. Roll pages have exact physical dimensions and one label per page; sheets use explicit paper size, rows, columns, margins and gaps. Browser/OS printer selection remains user controlled. Render only a sample while editing; expand copies only for output.

Code 128 must retain quiet zones and a minimum module width. A legacy 12-character SKU cannot safely fit every narrow stock size at 203 dpi. Reject incompatible barcode/media combinations with an actionable larger-size or text/QR-only choice; never squeeze the symbol. Small stock remains available for text/QR labels. Printed price is informational; POS reads current inventory asking price.

## Baseline validation

TypeScript passed. ESLint: zero errors, 537 existing warnings. Full suite: 889/890; the existing marketing capture-token tamper assertion failed at `tests/marketing-intelligence.test.ts:65`, also documented in Phase 1. No Phase 2 runtime edits preceded these checks.

## Physical QA still required

No physical compatibility is certified. Test a USB keyboard-wedge scanner; Zebra; Rollo/DYMO; Brother; and a Letter office printer. For each record model, driver, browser, media, DPI, barcode readability, alignment, 100% scale, no margins/headers, and exact repeat counts (1, 2, 10 and a large batch). Check first/last labels and sheet alignment. Test long names, repeated scans, worn labels, current prices after repricing, and exact batch deductions. Browser PDF tests establish structural pagination only.

## Implemented schema and security

Forward migration: `20260920190428_pos_barcode_labels.sql`. Historical migrations remain unchanged. The existing identity table gains optional position and location bindings. Active-item uniqueness now applies only to item-level identities; separate indexes enforce active position/location uniqueness. Location targets use a null item reference and an explicit target-shape constraint. The existing item foreign-key cascade remains, with private tombstones retaining deleted codes. API roles cannot delete identities. A trigger prevents changing the SKU, QR token, barcode value, owner, workspace or target. Position deletion archives its labels. Depleted positions are inactive for sales; archived batches with remaining canonical stock remain sellable.

`inventory_barcode_aliases` retains one workspace/value mapping, immutable target, type, source, creator/time and active state. Rows survive target deletion. Management may deactivate/reactivate the same mapping, never retarget it. Direct table access is denied; RPCs enforce ownership. This retains mapping history, not every activation toggle. UPC/EAN leading zeroes and external case are preserved; internal TD codes normalize to uppercase. Code 128 supplies the symbol checksum.

Public RPCs: `label_targets`, `label_locations`, `assign_label_barcode`, `set_default_label_template`, and the RLS predicate `label_actor_allowed`. Private helpers issue identities, resolve scans, protect identity fields and retire deleted positions. Separate target/alias/print API routes use streamed body limits and same-origin checks. Workspace comes from authenticated context; database checks independently enforce entitlement, membership, suspended users and inactive employees. Existing template/identity RLS is strengthened. Cross-tenant unknown codes disclose no other tenant's existence. Logs contain outcomes, not scanned values or inventory payloads.

The `pos_command` interface remains. Exact resolution checks internal SKU/QR, assigned alias, UPC, then legacy SKU/product/provider fields. Ambiguity, inactive/deleted and wrong-class outcomes fail closed. Unknown UI offers Search Inventory, manager-only Assign Barcode, and Cancel. Quick Item remains Planned with advanced checkout. Generic merchandise uses item identity; new positioned singles use position identity. Legacy item labels cannot retroactively acquire provenance they never encoded.

Cart lines key by item plus position. Checkout supports two positions of one item while retaining Phase 1 locks, reservations, idempotency, integer amounts and rollback. Exact lines allocate before generic lines. A new allocation `line_key` keeps each immutable movement's provenance specific to that line. Receipt condition/finish/language follows the selected position when present. Current item asking price remains authoritative.

## Templates and printing

System presets: Trading Card Compact (2×1), Standard (2.25×1.25), Showcase Price (2×2), Product Barcode (3×2), Bin/Location (3×2), Inventory/Shipping Style (4×6). The last is an inventory layout, not a carrier shipping label. Also supported: 1×0.5, 1×1, 1.5×1, 4×2, and custom inches/mm. Dimension precision is widened to six decimals without changing stored values. Orientation explicitly selects the long/short physical sides.

Existing `template_data` gains structured `print` settings: field order/visibility, bounded 6–14 pt text, price emphasis, human-readable code, store name, border, roll/sheet mode and sheet geometry. Organization templates support create/duplicate, rename/edit, default and archive. System presets cannot be overwritten. Legacy template records/elements remain; known bindings become ordered fields in the new safe flow renderer. Arbitrary legacy coordinates are not used. Existing pricing-review actions remain. Templates never mutate inventory or asking price.

Pinned `bwip-js@4.11.4` renders Code 128 SVG with ten-module quiet zones, black on white, integer 203-dpi dot multiples (two minimum, up to four for wide stock), and 8/12/18 mm bar heights. Optional text shrinks/drops before bars; required content that cannot fit blocks preparation. QR carries an opaque SKU, not sensitive data or a public-access token.

Product presets may encode a manufacturer UPC using Code 128 while retaining the internal SKU as human-readable text. The server only supplies that UPC when it uniquely identifies the owned sealed item and does not conflict with an assigned alias; otherwise output falls back to the canonical internal code. Later external mapping changes can still require manager review at checkout; scans never guess.

Preview is one sandboxed iframe using the actual server renderer, independent of queue size. The separate print window contains no dashboard DOM. Roll mode sets physical `@page`, zero margins, overflow bounds and a final-page break override. Sheet mode separately groups rows/columns using physical paper, margin and gap values; Letter is the initial preset. Browser printer selection remains user controlled. There is no automatic printing on refresh. An in-flight/open-window guard prevents duplicate preparation; jobs over 500 labels require confirmation. Limits: 500 queue rows, 1,000 copies per row, 10,000 total.

The existing print-job table records status `preview`, `dialogPrepared:true`, source, IDs, counts and template name. No HTML is stored and no physical-success claim is made. Printer profiles and a full alias-toggle audit are Planned follow-ups.

## Entry points and lifecycle

Inventory rows/details, binder details, location bulk selection and put-away selection open canonical Label Studio. Up to 50 IDs use a compact URL; up to 500 use tab-scoped session storage with an opaque selection reference. Only IDs travel; the server resolves current ownership/data. Resolved queue keys carry item/position/location prefixes to prevent collisions between target classes. Missing selection storage gives a recovery message.

Chaos Sort post-commit and batch-content actions pass the batch ID and resolve actual committed positions, never unresolved recognitions. The original one-label batch print route is preserved. POS adds Label Printing and Hardware links. Label Studio supports recent inventory and name/SKU/location/batch searches; refresh/reprint rereads current prices. Hardware shares the checkout scanner controller and links to the printer test. Feedback is visual and accessible; sounds are not required or implemented.

Corrections retaining the canonical item/position retain its code. Corrections replacing the canonical position must retire/delete the old position and print the new target's label. No successor is inferred by name. Moves must preserve the canonical item's/position's consistent location; POS still requires that location to be mapped to the active store site.

## Repeatable validation

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:pos:db`, `npm run test:labels:print`, `npm run test:labels:browser`, and `npx playwright test --config playwright.print.config.ts`. Fixture dependencies and loopback boundaries are described in `POS_PHASE1_VALIDATION.md`. `node tests/pos-db.mjs --advisors` runs Supabase security advisors against the disposable local database, never an app environment URL.

Browser workflow tests execute production Label Studio, Register and renderer with actual SQL behind a loopback HTTP adapter: inventory selection → labels → PDF → scan → cash sale → movement provenance. They do not replace hosted Supabase cookie/PostgREST or full production-dashboard acceptance. Physical hardware remains untested.
