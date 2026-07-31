import { BuylistWorkspace } from "@/components/dashboard/buylist/BuylistWorkspace";
export default async function SellOptimizerPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const { card = "" } = await searchParams;
  return <BuylistWorkspace mode="inventory" initialQuery={card} />;
}
