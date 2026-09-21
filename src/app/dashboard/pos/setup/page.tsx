import { PosSetup } from '@/components/pos/PosSetup';
import { posCommand } from '@/lib/pos/server';
import type { Bootstrap } from '@/lib/pos/domain';
import { HardwareRecommendations } from '@/components/hardware/HardwareCatalog';
import { hardwareViews } from '@/lib/hardware/server';
export default async function PosSetupPage() {
  const result = await posCommand('bootstrap', {});
  if (result.response) return <p role="alert">POS setup is unavailable. Check workspace access and rollout status.</p>;
  const data = result.data as Bootstrap;
  if (!data.canManage) return <p role="alert">A workspace manager must configure POS.</p>;
  return <><h2>Set up a store location</h2><PosSetup data={data} /><HardwareRecommendations views={hardwareViews()} source="pos_onboarding" /></>;
}
