# Bulk Purchases v106

## One required database step

Before using **Inventory → Bulk Purchases**, open the Supabase SQL Editor and
run:

`supabase/migrations/202607290001_bulk_purchase_profitability.sql`

Run the complete file once. It is safe to run again because the migration uses
`if not exists` and replaces its own policies.

## Included workflow

1. Open **Inventory** and select **Bulk Purchases**.
2. Create a purchase with its card count, amount paid, source, and date.
3. Select **Import cards to a purchase** and choose a CSV.
4. Confirm the detected card quantity and scanned value.
5. Import the file. Every resulting inventory row is linked to the purchase.
6. Review scanned value, projected profit, cash position, and break-even
   progress on the purchase detail panel.

Advanced fields, including additional expenses and cost-basis method, remain
collapsed unless needed.

## Profit definitions

- **Projected profit:** sales revenue minus selling costs, plus remaining
  scanned inventory value, minus purchase cost and expenses.
- **Cash position:** net sales revenue minus purchase cost and expenses.
- **Break-even progress:** net sales revenue divided by total investment.

Marketplace order connections can write sale allocations to
`bulk_purchase_sales`, which is included in the migration for the next sales
integration step.
