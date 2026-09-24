/** Database-validated scope, shared by mobile and web inventory requests. */
export async function currentInventoryWorkspace(client: {
  rpc(name: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}): Promise<string> {
  const { data, error } = await client.rpc("current_inventory_workspace");
  if (error || typeof data !== "string" || !data) {
    throw new Error(error?.message ?? "Choose an authorized active workspace.");
  }
  return data;
}
