import { FeedbackCenter } from "@/components/dashboard/feedback/FeedbackCenter";
import { createClient } from "@/lib/supabase/server";

export default async function FeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <FeedbackCenter
      userId={user!.id}
      userEmail={user!.email ?? ""}
    />
  );
}

