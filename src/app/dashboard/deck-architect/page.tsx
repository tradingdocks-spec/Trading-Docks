import { redirect } from "next/navigation";

import { DeckArchitectWorkspace } from "@/components/dashboard/deck-architect/DeckArchitectWorkspace";
import { loadDeckArchitectServerState } from "@/lib/deck-architect/server";
import { createClient } from "@/lib/supabase/server";

export default async function DeckArchitectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard/deck-architect");

  const { snapshot, intelligence, savedDecks } = await loadDeckArchitectServerState(supabase, user);

  return <DeckArchitectWorkspace snapshot={snapshot} intelligence={intelligence} savedDecks={savedDecks} />;
}
