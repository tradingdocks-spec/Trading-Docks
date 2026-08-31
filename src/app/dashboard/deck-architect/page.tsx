import { redirect } from "next/navigation";

import { DeckArchitectWorkspace } from "@/components/dashboard/deck-architect/DeckArchitectWorkspace";
import { loadDeckArchitectServerState } from "@/lib/deck-architect/server";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import {
  canAccessHiddenDeckArchitect,
  DECK_ARCHITECT_VISIBLE,
} from "@/lib/product-visibility";
import { createClient } from "@/lib/supabase/server";

export default async function DeckArchitectPage({
  searchParams,
}: {
  searchParams?: Promise<{ deckId?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard/deck-architect");
  if (!DECK_ARCHITECT_VISIBLE) {
    const access = await resolvePlatformAccessForUser(supabase, user);
    if (!canAccessHiddenDeckArchitect(access)) redirect("/dashboard/deck-vault");
  }

  const { snapshot, intelligence, savedDecks, activeDeck } = await loadDeckArchitectServerState(
    supabase,
    user,
    { deckId: params?.deckId },
  );

  return <DeckArchitectWorkspace snapshot={snapshot} intelligence={intelligence} savedDecks={savedDecks} activeDeck={activeDeck} />;
}
