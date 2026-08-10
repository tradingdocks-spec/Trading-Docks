export const INVENTORY_QUANTITY_PAGE_SIZE = 1000;

export type InventoryQuantityRow = {
  id?: unknown;
  quantity?: unknown;
};

export type InventoryQuantityPageLoader = (
  from: number,
  to: number,
) => Promise<InventoryQuantityRow[]>;

export async function sumInventoryQuantityPages(
  loadPage: InventoryQuantityPageLoader,
  pageSize = INVENTORY_QUANTITY_PAGE_SIZE,
) {
  let total = 0;
  let from = 0;

  for (;;) {
    const page = await loadPage(from, from + pageSize - 1);
    for (const item of page) total += Number(item.quantity ?? 0);
    if (page.length < pageSize) return total;
    from += pageSize;
  }
}

export async function loadInventoryQuantityTotal(
  supabase: unknown,
  userId: string,
) {
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          order: (column: string, options?: { ascending?: boolean }) => {
            range: (
              from: number,
              to: number,
            ) => PromiseLike<{
              data: InventoryQuantityRow[] | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };
  };

  return sumInventoryQuantityPages(async (from, to) => {
    const { data, error } = await client
      .from('inventory_items')
      .select('id,quantity')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
}
