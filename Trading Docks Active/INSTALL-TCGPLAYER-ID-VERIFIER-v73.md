# Trading Docks TCGplayer ID Verifier v73

This update uses a TCGplayer Pricing Custom Export as the authoritative SKU
reference for conversions into TCGplayer.

## Workflow

1. Upload the source collection or inventory CSV.
2. Select TCGplayer as the output.
3. Use `Match products & prices` to enrich names and set information through
   TCGCSV.
4. Upload a TCGplayer Pricing Custom Export containing the desired products and
   variants.
5. Download the final TCGplayer CSV only after every row is verified.

## Verification rules

Each converted row must have exactly one reference match using:

- Product name
- Set name
- Collector number
- Condition
- Foil/nonfoil status

The reference row supplies the condition-specific TCGplayer SKU from the
`TCGplayer Id` column. Missing and ambiguous matches are never guessed. The
interface lists unresolved cards and keeps the final download locked until all
rows are verified.

The final export uses the exact 16-column header and ordering from
`TCGplayer__Pricing_Custom_Export_20260728_125739.csv`, with standard CSV
escaping and CRLF line endings.

No new Supabase migration or environment variable is required.
