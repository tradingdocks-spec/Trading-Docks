import { ImportedDeckLoader } from "@/components/dashboard/deck-vault/ImportedDeckLoader";

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  return <ImportedDeckLoader deckId={deckId} />;
}
