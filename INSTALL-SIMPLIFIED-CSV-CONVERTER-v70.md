# Trading Docks Simplified CSV Converter v70

This update replaces the overloaded converter screen with a compact guided
workflow:

1. Upload a CSV or expand `Paste CSV instead`.
2. Choose whether to download a converted file or save cards to inventory.
3. Review the essential card fields and complete the action.

The converter now hides the following controls until requested:

- Raw pasted CSV contents
- The complete card table beyond the first five preview rows
- All optional field-mapping controls
- The ManaBox-to-TCGplayer bridge explanation

Advanced field mapping still includes every canonical field and automatically
opens when an uploaded file cannot be confidently detected. Condition and
finish defaults remain visible because they affect inventory accuracy.

The conversion logic, exact uploaded templates, Seller/Store access controls,
foil and etched separation, TCGCSV enrichment, and safe ManaBox bridge are
unchanged.

No new Supabase migration or environment variable is required.
