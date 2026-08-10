import { CollectorCardDetail } from "@/components/dashboard/collector-workspace/CollectorCardDetail";

export default async function CollectorCardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  return <CollectorCardDetail cardId={decodeURIComponent(cardId)} />;
}
