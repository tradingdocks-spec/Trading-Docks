# POS pilot setup

Status: **Partially Implemented — pilot acceptance remains open.** Production rollout is not approved. Use the isolated staging store and synthetic stock until the acceptance owner authorizes a pilot.

1. Choose one store and designated operators. Record the browser, operating system, scanner and printer models, drivers and paper sizes.
2. Confirm the store owner has the appropriate membership. Create the store location, inventory-location mapping, tax rate and timezone; have the owner verify tax configuration.
3. Add staff. Give each person an individual login. Grant POS selling access and an explicit inventory delegation for this store. Manager status alone does not grant access to someone else's inventory.
4. Create registers and assign operators. Open a test drawer with $200. Record the amount independently.
5. Print one label, then 5, 25 and 100. Select the matching paper preset and 100% scale. Check alignment and trailing pages. Scan a printed label back into POS and verify the exact item and location.
6. Test the scanner with internal Code 128, UPC, unknown and partial barcodes, repeated scans, and at least 25 rapid scans. Repeat after a modal and after New Sale. A keyboard simulation does not certify the scanner.
7. Test the receipt printer at its actual width, preferably 80 mm. Check totals, tax, discounts, wrapping and cut position. Also test the normal-printer fallback.
8. Run a cash sale, partial/full refunds, return-to-stock and no-restock refunds. Test paid in, paid out and cash drop. Independently count and close the drawer; investigate every unexplained variance.
9. Verify a delegated employee can sell the owner's stock. Revoke that grant from another session and confirm the employee's existing cart cannot complete. Confirm a nondelegated manager cannot sell it.
10. Have a cashier request a discount and a different authorized manager approve it. Verify the receipt and approval history identify both people.
11. Square setup is **PENDING**. A Sandbox application, Sandbox seller, HTTPS callback, HTTPS webhook and server secrets must be supplied first. Never substitute production credentials. Test authorization, mapping, revocation, refunds and recovery before enabling a provider.
12. Physical Terminal testing is **PENDING**. Sandbox emulation does not certify physical pairing/payment. Confirm Square's supported test path before attempting hardware; a production/real-money test requires separate approval.
13. Simulate a lost response and reload. Use Check Payment Status / Retry Finalization for the existing attempt. Do not create a second charge while payment is uncertain.
14. Review `POS_PHASE7B_VALIDATION.md` and `POS_EXTERNAL_ACCEPTANCE_CHECKLIST.md`. Pilot approval requires the remaining external gates and separate production approval. Record devices in `POS_HARDWARE_ACCEPTANCE_SHEET.md`.

Current operational limits: at most 500 distinct cart lines and a 256 KiB request body. Larger carts are rejected before mutation. Use Letter receipts for practical large-sale printing; 500 detailed lines can require about 6.8 metres of 80 mm roll. The 10,000-row hosted search guard requires p95 below two seconds; this does not certify every store size. Provider throttling retries the same request once after Retry-After, then preserves manual recovery of the existing attempt.

Hardware availability is not automatically detected. Record physical results manually. A printable PDF, viewport test or simulated Terminal is not a physical pass.
