import { createClient } from "@/lib/supabase/client";

export async function loadAccountDocument<T>(documentKey: string): Promise<T | null> {
  const { supabase, userId } = await authenticatedClient();
  const { data, error } = await supabase
    .from("account_documents")
    .select("data")
    .eq("user_id", userId)
    .eq("document_key", documentKey)
    .maybeSingle();

  if (error) throw new Error(`Account data could not be loaded: ${error.message}`);
  return data ? (data.data as T) : null;
}

export async function saveAccountDocument(documentKey: string, data: unknown) {
  const { supabase, userId } = await authenticatedClient();
  const { error } = await supabase.from("account_documents").upsert(
    {
      user_id: userId,
      document_key: documentKey,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,document_key" },
  );

  if (error) throw new Error(`Account data could not be saved: ${error.message}`);
}

export async function deleteAccountDocument(documentKey: string) {
  const { supabase, userId } = await authenticatedClient();
  const { error } = await supabase
    .from("account_documents")
    .delete()
    .eq("user_id", userId)
    .eq("document_key", documentKey);

  if (error) throw new Error(`Account data could not be deleted: ${error.message}`);
}

async function authenticatedClient() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in again to access your account data.");
  return { supabase, userId: user.id };
}

