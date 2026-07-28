# Trading Docks TCGplayer Header Fix v72

This update matches TCGplayer's accepted CSV formatting using the supplied
`tcgplayer_output (4)(1).csv` as the reference.

The TCGplayer export now writes:

- The exact 16 accepted headers
- The exact accepted header order and capitalization
- Double quotes around every header
- Double quotes around every data value
- Escaped embedded quotation marks
- Windows-style CRLF row endings
- No additional or renamed columns

Other marketplace exports retain their existing conventional CSV escaping.

This package also includes the v71 correction that distinguishes TCGCSV product
matches from condition-specific TCGplayer inventory SKU IDs.

No new Supabase migration or environment variable is required.
