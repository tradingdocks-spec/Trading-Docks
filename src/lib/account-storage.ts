import { createClient } from "./supabase/client";

export async function accountStorageKey(baseKey: string) {
  const {
    data: { user },
  } = await createClient().auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to access account data.");
  }

  return `${baseKey}:${user.id}`;
}
