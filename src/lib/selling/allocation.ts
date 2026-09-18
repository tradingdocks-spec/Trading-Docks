export type AllocationMath = {
  physicalQuantity: number;
  activeReservations: number;
};

export function calculateAvailableQuantity({ physicalQuantity, activeReservations }: AllocationMath) {
  return Math.max(0, Math.floor(physicalQuantity) - Math.max(0, Math.floor(activeReservations)));
}

export type SellingRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function reserveSellingInventory({
  supabase,
  workspaceId,
  candidateId,
  quantity,
  idempotencyKey,
}: {
  supabase: SellingRpcClient;
  workspaceId: string;
  candidateId: string;
  quantity: number;
  idempotencyKey: string;
}) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Allocation quantity must be a positive whole number.");
  const { data, error } = await supabase.rpc("reserve_selling_inventory", {
    p_workspace_id: workspaceId,
    p_candidate_id: candidateId,
    p_quantity: quantity,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function releaseSellingInventory({
  supabase,
  workspaceId,
  allocationId,
  idempotencyKey,
}: {
  supabase: SellingRpcClient;
  workspaceId: string;
  allocationId: string;
  idempotencyKey: string;
}) {
  const { data, error } = await supabase.rpc("release_selling_inventory_allocation", {
    p_workspace_id: workspaceId,
    p_allocation_id: allocationId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data;
}
