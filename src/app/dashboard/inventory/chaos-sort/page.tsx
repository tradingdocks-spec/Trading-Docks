import { ChaosSortWorkspace } from "@/components/dashboard/inventory/ChaosSortWorkspace";
import { createClient } from "@/lib/supabase/server";
import { scannerBridgeOwnerAccess } from "@/lib/chaos-sort/scanner-bridge-access";

export default async function ChaosSortPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const scannerBridgeEnabled = !error && await scannerBridgeOwnerAccess(supabase, user);
  return <ChaosSortWorkspace key={String(scannerBridgeEnabled)} scannerBridgeEnabled={scannerBridgeEnabled} />;
}
