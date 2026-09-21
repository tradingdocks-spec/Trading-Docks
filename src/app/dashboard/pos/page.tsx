import { Register } from '@/components/pos/Register';
import { posContext } from '@/lib/pos/server';
import type { Bootstrap } from '@/lib/pos/domain';
export default async function PosPage() {
  const context = await posContext();
  if (!context.ok) return <p role="alert">Choose an authorized workspace to open POS.</p>;
  const { data, error } = await context.supabase.rpc('pos_command', { p_workspace_id: context.workspaceId, p_action: 'bootstrap', p_body: {} });
  if (error) return <div className="pos-empty"><h2>POS is not available yet</h2><p>This workspace needs an enabled POS rollout and the reviewed database migration. Your existing inventory is unchanged.</p></div>;
  return <Register data={data as Bootstrap} workspaceId={context.workspaceId} actorId={context.user!.id} />;
}
