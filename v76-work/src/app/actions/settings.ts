"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function saveSettings(settings: Record<string, unknown>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard/settings");

  const { data, error: readError } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const preferences =
    data?.preferences &&
    typeof data.preferences === "object" &&
    !Array.isArray(data.preferences)
      ? data.preferences
      : {};

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      preferences: {
        ...preferences,
        settings,
        settings_updated_at: new Date().toISOString(),
      },
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}
