# Chaos Sort label printing

Status: Implemented.

The normal batch **Print label** link hard-navigates to `/dashboard/inventory/chaos-sort/labels/[batchId]/print`. This authenticated route handler returns a standalone HTML document, bypassing the Next.js root and dashboard layouts. It selects one batch by ID and owner and its optional session code; it never queries batch positions or other batches.

`ChaosSortBatchLabel` renders one SVG label with a Trading Docks mark, batch code, location, card quantities, session reference, batch ID, creation date, and an embedded vector QR linking back to the batch. The screen preview loads the same SVG renderer with `preview=1&format=svg`, without scripts. Using an image preserves the existing frame-blocking security headers. The print document itself has exactly one label root and no iframe, table, dashboard shell, or hidden duplicate label.

The previous full-page print action used `visibility: hidden`, retaining dashboard and table layout space and allowing additional pages. Its page-size variables were scoped inside the label. The isolated document now writes a concrete zero-margin `@page`, fixes the document and label dimensions, removes controls from print layout with `display: none`, and fits the SVG within that page.

## Media and timing

The existing default remains DK1201, **29 x 90 mm**. DK1208 (38 x 90 mm), DK1202 (62 x 100 mm), custom dimensions (10-200 mm), and top/center/bottom alignment are preserved. Preferences remain in `td.batch-label-media`. The shared media resolver validates both preview and print URLs. No copies, all-batches, or bulk parameter is supported by this route. Label Studio remains a separate explicitly selected multi-label workflow.

Automatic printing waits for document load, fonts, image decoding, and two animation frames. A guard allows one automatic invocation per document. The preview never invokes printing. The explicit **Print one label** button supports retrying after cancellation.

## Verification

- `npm test` includes single-root rendering, escaping, media resolution, action isolation, authenticated ownership filtering, and missing/error responses.
- `npx playwright test --config playwright.print.config.ts` uses installed Chrome and Edge against a loopback-only fixture server that renders the production batch component and print document. It tests a 300-row batch, switching batches, one automatic print, readiness, preview isolation, and explicit retry.
- PDF checks cover all three presets and a landscape custom size, each at top/center/bottom alignment. Each output must have exactly one page and the requested physical dimensions. Synthetic records include a long location and full identifiers.
- Generated PDFs are kept under ignored `.local-fixtures/chaos-sort-print/` for visual inspection.

Physical printer drivers can override page size, scaling, and copies. Select matching media, 100% scale, one copy, and disable browser headers/footers. Hardware output and the native OS print dialog require local printer QA; automated PDF verification does not certify driver settings.
