import { requireApiCapability } from '@/lib/platform/server-access';
import { POS_ERRORS } from './domain';

export async function posContext() {
  const context = await requireApiCapability('pos.sell');
  if (!context.ok) return context;
  if (!context.access.workspaceId) return { ok: false as const, response: Response.json({ error: 'Choose an active workspace first.' }, { status: 403 }) };
  return { ...context, workspaceId: context.access.workspaceId };
}
export async function posCommand(action: string, body: Record<string, unknown>) {
  const context = await posContext();
  if (!context.ok) return { response: context.response };
  const { data, error } = await context.supabase.rpc('pos_command', { p_workspace_id: context.workspaceId, p_action: action, p_body: body });
  if (error) {
    const code = Object.keys(POS_ERRORS).find(code => error.message.includes(code));
    const transient = error.code === '40P01' || error.code === '40001';
    console.warn('pos.command.failed', { action, code: code ?? error.code });
    return { response: Response.json({ error: code ? POS_ERRORS[code] : transient ? 'Inventory changed during checkout. Retry this checkout.' : 'POS could not complete this request. Check setup or try again.', code: code ?? (transient ? 'POS_RETRY' : 'POS_UNAVAILABLE') }, { status: code === 'POS_FORBIDDEN' || code === 'POS_DISABLED' ? 403 : code ? 409 : 503, headers: { 'Cache-Control': 'no-store' } }) };
  }
  return { data };
}
