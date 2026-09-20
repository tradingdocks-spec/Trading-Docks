import { posContext } from "@/lib/pos/server";
import type { Bootstrap } from "@/lib/pos/domain";
import { Operations } from "./Operations";
export async function OperationsPage({
  mode,
}: {
  mode: "registers" | "staff" | "daily";
}) {
  const context = await posContext();
  if (!context.ok)
    return <p role="alert">Sign in to an authorized POS workspace.</p>;
  const { data, error } = await context.supabase.rpc("pos_command", {
    p_workspace_id: context.workspaceId,
    p_action: "bootstrap",
    p_body: {},
  });
  if (error)
    return <p role="alert">POS operations are unavailable for this account.</p>;
  return (
    <Operations
      mode={mode}
      data={data as Bootstrap}
      scope={`${context.workspaceId}.${context.user!.id}`}
    />
  );
}
