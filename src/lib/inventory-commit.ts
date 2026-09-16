export type CommitClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message?: string; code?: string } | null;
  }>;
};

export class InventoryCommitError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export async function executeInventoryCommit(
  client: CommitClient,
  name: "commit_order_fulfillment" | "commit_csv_inventory_import",
  args: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const unavailable = error.code === "PGRST202" || error.code === "42883";
    const status = unavailable ? 503 : error.code === "P0002" ? 404
      : error.code === "22023" || error.code === "22P02" ? 400
      : error.code === "P0001" || error.code === "23505" ? 409 : 500;
    throw new InventoryCommitError(unavailable
      ? "Inventory commits are unavailable until the database update is configured. Nothing was committed."
      : error.message || "Inventory commit failed. Retry the same operation.", status);
  }
  if (!data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
    throw new InventoryCommitError("The commit could not be confirmed. Retry the same operation to check its result.");
  }
  return data as Record<string, unknown>;
}

export const isOrderId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
