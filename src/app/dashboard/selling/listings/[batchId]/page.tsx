import { SellingPlaceholder } from "@/components/dashboard/selling/SellingPlaceholder";

export default async function SellingListingBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return <SellingPlaceholder title={`Listing batch ${batchId}`} description="Batch-level candidate review will retain the source session, physical position, location, cost basis, and readiness explanation." nextHref="/dashboard/selling/listings" />;
}
