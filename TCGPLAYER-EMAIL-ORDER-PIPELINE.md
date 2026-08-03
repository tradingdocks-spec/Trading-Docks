# TCGplayer email order pipeline

This release connects stored inbound TCGplayer order emails to the Universal Orders Center.

- Incoming mail is authenticated and deduplicated.
- Supported TCGplayer order messages are parsed on receipt.
- Existing backlog messages can be reprocessed with **Check & import orders**.
- Orders use a three-column uniqueness key: user, marketplace, external order ID.
- Line items use deterministic IDs, so retries do not duplicate rows.
- Low-confidence or incomplete messages remain in Needs Review.
- Unsupported messages are never silently converted into orders.

Run `00_RUN_THIS_IN_SUPABASE_TCGPLAYER_EMAIL_ORDERS.sql` once before deployment.
