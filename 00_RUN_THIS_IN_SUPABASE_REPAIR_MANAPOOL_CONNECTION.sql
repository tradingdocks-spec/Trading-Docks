-- Repair older Mana Pool connections saved before self-service ready status.

insert into public.marketplace_connections (
  user_id, marketplace_id, connection_method, status, settings, updated_at
)
select
  mc.user_id,
  'mana-pool',
  'api',
  'ready',
  jsonb_build_object('credentials_saved', true),
  now()
from public.marketplace_credentials mc
where mc.marketplace_id in ('mana-pool', 'manapool')
on conflict (user_id, marketplace_id)
do update set
  connection_method = 'api',
  status = 'ready',
  settings = coalesce(public.marketplace_connections.settings, '{}'::jsonb) || jsonb_build_object('credentials_saved', true),
  updated_at = now();

notify pgrst, 'reload schema';
