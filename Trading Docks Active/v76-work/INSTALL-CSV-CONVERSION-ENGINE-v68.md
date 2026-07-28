# Trading Docks CSV Conversion Engine v68

Copy the included files into the matching project paths and redeploy.

No Supabase migration or additional environment variable is required.

Access behavior:

- Seller and Store accounts see `Tools → CSV Conversion Engine`.
- Free and Collector accounts do not see the Tools section.
- Direct visits to `/dashboard/tools/csv-converter` are checked server-side and
  redirected to the plan comparison page without Seller-level access.

The converter accepts uploaded or pasted CSV data, automatically maps common
columns, allows mapping review, previews converted rows, exports several
platform formats, and can save reviewed inventory into a named storage
location with an optional marketplace allocation.
