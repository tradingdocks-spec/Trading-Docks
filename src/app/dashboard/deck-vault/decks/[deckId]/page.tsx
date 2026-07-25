import { ImportedDeckLoader } from "@/components/dashboard-v2/deck-vault/ImportedDeckLoader";
import { decks } from "@/lib/deck-vault/sample-data";

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const fallback = decks.find((entry) => entry.id === deckId);

  return <ImportedDeckLoader deckId={deckId} fallback={fallback} />;
}
