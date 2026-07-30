# eBay Import Header and Diagnostics Fix — v117

- Removed the optional `Accept-Language` header from U.S. Inventory and
  Fulfillment API requests because eBay rejected it before returning data.
- Preserved the required OAuth, JSON, and marketplace headers.
- Added endpoint-specific eBay errors, including the long message and error ID
  when eBay supplies them.
- Refreshes reconciliation history after failed imports so the failure is
  visible immediately.
- Handles network failures without leaving the Import button stuck.

No database migration or new environment variable is required.
