import { redirect } from "next/navigation";

import { DeckArchitectWorkspace } from "@/components/dashboard/deck-architect/DeckArchitectWorkspace";
import { loadDeckArchitectCollectionSnapshot } from "@/lib/deck-architect/server";
import { createClient } from "@/lib/supabase/server";

export default async function DeckArchitectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard/deck-architect");

  const snapshot = await loadDeckArchitectCollectionSnapshot(supabase, user);

  return <DeckArchitectWorkspace snapshot={snapshot} />;
}
