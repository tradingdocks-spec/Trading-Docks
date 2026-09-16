# Trading Docks — First-Time User UX / Clarity Audit

Status: Audit completed; P0/P1 implementation in progress  
Audience: a new card-store owner using the authenticated web dashboard for the first time  
Scope: authenticated dashboard routes and the active web navigation in `src/app/dashboard` and `src/components/dashboard`

## Executive summary

The current dashboard has strong feature coverage and several thoughtful safety messages, but a first-time seller is asked to understand Trading Docks' internal model before they can confidently act. The largest usability risk is workflow discoverability: the active sidebar does not expose a web Chaos Sort workflow, and the navigation configuration contains links for routes that do not exist in the current app. CSV Conversion is the most complete intake workflow, but it describes itself as a technical converter and hides the most important mapping and inventory consequences behind advanced controls.

This audit intentionally does not claim that a web Chaos Sort implementation exists. The current product contains mobile scanner foundations and a web image-lookup tool, but there is no authenticated web route that takes a user from a pile of cards through review, storage location, and inventory commit. Building that end-to-end workflow requires a product decision about scanner authority, supported games, and whether image recognition is production-ready.

## Routes audited

### Core workflows

| Route | Current surface | First-time-user assessment |
| --- | --- | --- |
| `/dashboard` | Dashboard / command center | Useful metrics, but the next best action depends on data already existing. |
| `/dashboard/inventory` | Collection workspace and storage assignment | Good foundation; “Collection” and “Inventory” are used interchangeably and intake is not the first obvious action. |
| `/dashboard/inventory/[cardId]` | Card detail | Useful for an existing card; not a clear entry point for adding stock. |
| `/dashboard/inventory/bulk-purchases` | Bulk purchases | Requires prior knowledge of the acquisition model. |
| `/dashboard/tools/csv-converter` | CSV Conversion Engine | Functional and safety-conscious, but terminology and review states are too technical. |
| `/dashboard/card-photo-scanner` | Image Lookup | Explains recognition limits, but is not presented as a batch intake workflow and does not create inventory as the primary path. |
| `/dashboard/collection-buying` | Collection Buying | Has a clear commercial purpose, but the relationship between buying a collection, a purchase record, and inventory intake needs stronger signposting. |
| `/dashboard/purchasing-intelligence` | Purchasing Intelligence | Feature value is not self-evident before data is connected. |
| `/dashboard/purchase-history` | Purchase History | Empty and post-action guidance should link back to intake and inventory. |
| `/dashboard/marketplaces` | Marketplace workspace | “Connection”, “sync”, “import”, and “listing” are separate concepts but are not consistently introduced. |
| `/dashboard/marketplaces/ebay` | eBay workspace | Needs explicit before/after explanation of read-only import and synchronization boundaries. |
| `/dashboard/orders` | Universal Orders Center | A new seller needs a stronger empty state and a direct “Connect a marketplace” recovery path. |
| `/dashboard/card-shows` | Card show inventory workflow | “Temporary inventory location” is accurate but unfamiliar without explaining reservation and return-to-stock behavior. |
| `/dashboard/analytics` | Analytics command center | Metrics are useful after inventory exists; empty data should explain what creates each metric. |
| `/dashboard/reports` | Business Intelligence | Technical naming makes this feel like an admin/reporting tool rather than a seller outcome. |
| `/dashboard/sell-optimizer` | Sell Optimizer | Needs a clear prerequisite statement: which inventory and marketplace data it uses. |
| `/dashboard/seller-launch` | Seller Launch | Strong candidate for first-use guidance, but should link users into the first successful intake. |
| `/dashboard/collector-portfolio` | Collector Portfolio | Collector-oriented terminology is distinct from store inventory but the navigation does not explain the boundary. |
| `/dashboard/deck-vault` | Deck Vault | Specialized feature; not a first-time store workflow. |

### Operations, account, and supporting surfaces

| Route | First-time-user assessment |
| --- | --- |
| `/dashboard/settings` | Broad and honest in places, but contains placeholder actions that look active and a storage-location control that does not create a location. |
| `/dashboard/feedback` | Useful recovery path; should be linked from actionable failure states. |
| `/dashboard/analytics`, `/dashboard/automation`, `/dashboard/calendar`, `/dashboard/tasks`, `/dashboard/tournaments`, `/dashboard/vendors`, `/dashboard/supplies`, `/dashboard/employees`, `/dashboard/payroll` | Audited as secondary operational tools; each needs a purpose-led empty state and prerequisite links as its workflow matures. |
| `/dashboard/plans`, `/dashboard/billing/success`, `/dashboard/purchase-history` | Audited for access and post-purchase clarity; plan gates should explain what becomes available and why. |
| `/dashboard/showcase`, `/dashboard/showcase/kiosks`, `/dashboard/showcase/requests`, `/dashboard/showcase/settings` | Audited as public/showcase workflows; outside the primary intake scope. |
| `/dashboard/admin/**` | Excluded from normal-user changes as requested. |

## Findings and proposed corrections

| ID | Route / area | Current problem | Why a new user could misunderstand it | Proposed correction | Priority |
| --- | --- | --- | --- | --- | --- |
| F-01 | Active sidebar / imports | No web Chaos Sort route or entry point exists. | A flagship workflow named in product materials cannot be found; “Image Lookup” sounds like a lookup utility, not intake. | Add a clearly labeled first-intake entry only when the underlying workflow is available; until then, label the existing scanner honestly and link it to the supported next step. | P0 |
| F-02 | Legacy navigation catalog | An older, inactive navigation catalog still contains `/dashboard/organization/*`, `/dashboard/imports/*`, `/dashboard/listings/*`, `/dashboard/shipping`, `/dashboard/warehouse`, `/dashboard/workspaces`, and `/dashboard/price-alerts` without corresponding page routes. | Future work that reuses the older catalog could reintroduce 404/dead-end links. | Keep the active account-aware catalog as the source of truth and remove or reconcile the legacy catalog before reusing it. | P1 |
| F-03 | CSV Conversion | The page title says “CSV Converter” and the primary save action says “Save cards”. | A seller cannot tell whether this exports a file or changes inventory. | Introduce a concise “Import or convert inventory files” intro, explicit destination choices, and consequence-specific CTA labels. | P1 |
| F-04 | CSV Conversion | “Unknown / Generic” and header-match percentage expose parser terminology. | Users may think their file failed or that a percentage is a quality score. | Use “Format not recognized yet” and explain manual mapping in plain language. | P1 |
| F-05 | CSV Conversion | Required/optional field expectations are only discoverable by opening Advanced options. | A user can upload a file without knowing what is needed to import safely. | Add a compact “What your file needs” helper with required versus optional fields and an expandable mapping guide. | P1 |
| F-06 | CSV Conversion | Review rows are shown in a dense table with technical TCGplayer reasons. | “SET_MAPPED_NO_PRODUCT” is not actionable to a store owner. | Map internal reason codes to human-readable explanations and group results into Ready, Needs review, and Could not match. | P1 |
| F-07 | CSV Conversion | Inventory commit success is shown as a transient toast with only units/location. | The user may not know whether duplicates were combined, a batch was created, or what to do next. | Add an inline completion summary with cards saved, location, duplicate behavior, and links to Inventory and the next workflow. | P1 |
| F-08 | Inventory / Collection | The same ownership surface is labeled “Collection”, “Inventory”, and “Collection Workspace”. | A store owner may not know where sellable stock lives or whether Collection is a separate personal feature. | Use “Inventory” as the store-facing heading and explain Collection as the ownership record only where relevant. | P1 |
| F-09 | Storage locations | Storage is available inside Collection, settings, and card detail with different labels. | Users can miss the place to create bins before intake. | Add a reusable storage helper and contextual “Create storage location” link at intake and empty inventory states. | P1 |
| F-10 | Settings | Several Connect/Set up/Upload buttons are visual placeholders without behavior. | A new user cannot distinguish available configuration from future work. | Mark unavailable controls as Planned/Coming soon or wire them to their supported route. | P1 |
| F-11 | Orders / marketplaces | Empty states depend on knowing that a marketplace connection is a prerequisite. | “No orders” can be mistaken for a sync failure. | State whether no channel is connected, no orders were found, or sync needs attention; include the next action. | P1 |
| F-12 | Empty states | Secondary pages frequently use short state labels rather than outcome-oriented guidance. | “No batches found” or “No inventory” does not explain what belongs there or how to create it. | Standardize a reusable EmptyState with reason, next action, and related workflow link. | P1 |
| F-13 | Terminology | “Commit”, “save”, “import”, “convert”, “recognition”, and “matching” overlap. | Users cannot predict whether an action only prepares data or changes inventory. | Reserve “Match” for identifying cards, “Review” for user decisions, “Import into inventory” for a write, and “Export” for a download. | P1 |
| F-14 | Mobile dashboard | Mobile navigation is compact but contextual guidance has not been systematically checked at narrow widths. | Helper content can push primary actions below the fold or create dense horizontal controls. | Keep intro/workflow helpers compact and stack steps/controls at mobile widths. | P2 |
| F-15 | Accessibility | Existing controls generally use native buttons, but tooltip/help patterns are not reusable or standardized. | Important explanations may become hover-only as new guidance is added. | Build help primitives with focusable buttons, visible expanded content, and ARIA relationships. | P2 |
| F-16 | Chaos Sort decision | Product terminology and supported web recognition authority are not settled. | Implementing a web version now could promise recognition behavior the current architecture explicitly treats as partial/beta. | Decide whether web Chaos Sort is a mobile handoff, a manual-first batch intake, or a production recognition workflow before building the end-to-end route. | P0 |

## Terminology audit

Recommended user-facing vocabulary:

| Avoid or limit | Prefer | Meaning |
| --- | --- | --- |
| Collection / Inventory used interchangeably | Inventory | Cards the store owns and can locate, sell, export, or move. |
| Session | Intake batch | A group of cards processed together. Keep “session” for scanner implementation details only. |
| Batch target | Destination | Where the cards will be stored or assigned. |
| Location / Storage location | Storage location | A named physical place such as Bin A-14 or Trade Binder. |
| Recognition | Card matching | Identifying a card and its exact printing. |
| Commit / Save cards | Import into inventory | The action that writes cards to inventory. |
| NEEDS REVIEW | Needs review | A card or row that requires a user decision. |
| UNKNOWN / FAILED | Could not identify / Could not import | State the user-visible problem and recovery path. |
| Business Intelligence | Reports | Seller-facing reporting; retain the technical name only in internal code. |

## Chaos Sort assessment

The requested web workflow is not currently implemented. The available web scanner is `/dashboard/card-photo-scanner`, an image lookup surface with manual confirmation and explicit beta limitations. Historical mobile scanner documentation describes review-safe recognition states, but that does not establish a supported web batch-intake contract.

Required product decision before implementation:

1. Is Chaos Sort web-based, mobile-based, or a handoff between both?
2. Which games and recognition signals are supported for a production claim?
3. Does a reviewed card write immediately to inventory, or only after a batch-level confirmation?
4. Are storage locations created during the workflow or selected from existing locations?

Until those decisions are accepted, the safe correction is to avoid exposing a misleading “Chaos Sort” CTA and make the existing scanner's purpose and limitations explicit.

## Implementation scope for this branch

This branch implements the P0/P1 corrections that are safe without changing schemas, recognition authority, or deployment configuration:

- reusable first-use guidance primitives: `FeatureIntro`, `WorkflowSteps`, `ContextHelp`, and `EmptyState`;
- clearer CSV/import copy, detected-format messaging, field guidance, human-readable review reasons, and explicit inventory-write CTAs;
- an inline import completion summary with next actions;
- honest scanner purpose copy and recovery guidance;
- removal of navigation links that currently point to unavailable routes;
- targeted tests for the new terminology and import guidance contracts.

The following remain intentionally unimplemented: a new web Chaos Sort recognition pipeline, new Supabase schema, marketplace API connections, and production deployment.
