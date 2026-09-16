import { getActiveWorkspaceContext } from "./active-workspace";

export async function loadAccountDocument<T>(documentKey: string): Promise<T | null> {
  const { supabase, workspaceId } = await getActiveWorkspaceContext();
  const { data, error } = await supabase
    .from("workspace_documents")
    .select("data")
    .eq("workspace_id", workspaceId)
    .eq("document_key", documentKey)
    .maybeSingle();

  if (error) throw new Error(`Account data could not be loaded: ${error.message}`);
  return data ? (data.data as T) : null;
}

export async function saveAccountDocument(documentKey: string, data: unknown) {
  const { supabase, userId, workspaceId } = await getActiveWorkspaceContext();
  const { error } = await supabase.from("workspace_documents").upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      document_key: documentKey,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,document_key" },
  );

  if (error) throw new Error(`Account data could not be saved: ${error.message}`);
}

export async function deleteAccountDocument(documentKey: string) {
  const { supabase, workspaceId } = await getActiveWorkspaceContext();
  const { error } = await supabase
    .from("workspace_documents")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("document_key", documentKey);

  if (error) throw new Error(`Account data could not be deleted: ${error.message}`);
}
