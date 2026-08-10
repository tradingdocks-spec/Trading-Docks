-- Staging-only QA seed for Label Studio + Inventory QR.
-- Requires 202608090001_label_studio_inventory_qr_proposal.sql to be applied
-- to a disposable staging database first.
--
-- This script rolls back all fixture data.

begin;

do $$
declare
  v_owner_id uuid := '00000000-0000-4000-8000-000000092001';
  v_admin_id uuid := '00000000-0000-4000-8000-000000092002';
  v_manager_id uuid := '00000000-0000-4000-8000-000000092003';
  v_member_id uuid := '00000000-0000-4000-8000-000000092004';
  v_viewer_id uuid := '00000000-0000-4000-8000-000000092005';
  v_other_owner_id uuid := '00000000-0000-4000-8000-000000092006';
  v_ambiguous_user_id uuid := '00000000-0000-4000-8000-000000092007';
  v_workspace_id uuid := '00000000-0000-4000-8000-000000093001';
  v_other_workspace_id uuid := '00000000-0000-4000-8000-000000093002';
  v_ambiguous_workspace_id uuid := '00000000-0000-4000-8000-000000093003';
  v_public_token text;
  v_disabled_token text;
  v_revoked_token text;
  v_generated_blank_sku text;
  v_valid_legacy_sku text := 'TD-M4N7-Q8RT';
  v_public_count integer;
  v_denied_count integer;
begin
  raise notice 'Creating staging QA users and workspaces.';

  insert into auth.users (id, email)
  values
    (v_owner_id, 'label-qa-owner@example.com'),
    (v_admin_id, 'label-qa-admin@example.com'),
    (v_manager_id, 'label-qa-manager@example.com'),
    (v_member_id, 'label-qa-member@example.com'),
    (v_viewer_id, 'label-qa-viewer@example.com'),
    (v_other_owner_id, 'label-qa-other@example.com'),
    (v_ambiguous_user_id, 'label-qa-ambiguous@example.com')
  on conflict (id) do nothing;

  -- auth.users insertion runs the production public.handle_new_user() trigger,
  -- which creates a default workspace, membership, and active preference. This
  -- staging seed then removes those generated defaults and defines each QA
  -- workspace state explicitly instead of disabling production triggers.
  delete from public.workspaces w
  where w.owner_id in (
    v_owner_id,
    v_admin_id,
    v_manager_id,
    v_member_id,
    v_viewer_id,
    v_other_owner_id,
    v_ambiguous_user_id
  )
    and w.name = 'Trading Docks';

  insert into public.workspaces (id, name, owner_id)
  values
    (v_workspace_id, 'Label QA Workspace', v_owner_id),
    (v_other_workspace_id, 'Label QA Other Workspace', v_other_owner_id),
    (v_ambiguous_workspace_id, 'Label QA Ambiguous Workspace', v_ambiguous_user_id);

  insert into public.workspace_members (workspace_id, user_id, role)
  values
    (v_workspace_id, v_owner_id, 'owner'),
    (v_workspace_id, v_admin_id, 'admin'),
    (v_workspace_id, v_manager_id, 'manager'),
    (v_workspace_id, v_member_id, 'member'),
    (v_workspace_id, v_viewer_id, 'viewer'),
    (v_other_workspace_id, v_other_owner_id, 'owner'),
    (v_workspace_id, v_ambiguous_user_id, 'member'),
    (v_ambiguous_workspace_id, v_ambiguous_user_id, 'member');

  insert into public.user_preferences (user_id, active_workspace_id)
  values
    (v_owner_id, v_workspace_id),
    (v_admin_id, v_workspace_id),
    (v_manager_id, v_workspace_id),
    (v_member_id, v_workspace_id),
    (v_viewer_id, v_workspace_id),
    (v_other_owner_id, v_other_workspace_id)
  on conflict (user_id) do update set active_workspace_id = excluded.active_workspace_id;

  update public.user_preferences up
  set active_workspace_id = null
  where up.user_id = v_ambiguous_user_id;

  raise notice 'Creating card, sealed, public, disabled, revoked, valid SKU, conflicting SKU, blank SKU, and ambiguous inventory fixtures.';

  insert into public.inventory_items (
    id,
    user_id,
    workspace_id,
    item_kind,
    card_name,
    product_name,
    sku,
    set_code,
    collector_number,
    quantity,
    asking_price,
    market_price,
    public_label_enabled,
    qr_public_enabled,
    data
  )
  values
    ('qa-card-public', v_owner_id, v_workspace_id, 'single', 'Unblinking Observer', null, '', 'MID', '82', 1, 1.99, 1.63, true, true, jsonb_build_object('condition', 'Near Mint', 'finish', 'normal', 'costBasis', 0.72, 'privateNotes', 'staff only')),
    ('qa-card-disabled', v_owner_id, v_workspace_id, 'single', 'Ledger Shredder', null, '', 'SNC', '46', 1, 8.99, 8.20, true, false, '{}'::jsonb),
    ('qa-sealed-public', v_owner_id, v_workspace_id, 'sealed', '', 'Modern Horizons 3 Bundle', '', null, null, 4, 79.99, 72.50, true, true, '{}'::jsonb),
    ('qa-valid-sku', v_owner_id, v_workspace_id, 'single', 'Valid SKU Card', null, v_valid_legacy_sku, null, null, 1, 3.00, 2.50, false, false, '{}'::jsonb),
    ('qa-conflict-a', v_owner_id, v_workspace_id, 'single', 'Conflict A', null, 'TD-ZZZZ-ZZZZ', null, null, 1, 2.00, 1.50, false, false, '{}'::jsonb),
    ('qa-conflict-b', v_owner_id, v_workspace_id, 'single', 'Conflict B', null, 'TD-ZZZZ-ZZZZ', null, null, 1, 2.00, 1.50, false, false, '{}'::jsonb),
    ('qa-blank-sku', v_owner_id, v_workspace_id, 'single', 'Blank SKU Card', null, '', null, null, 1, null, null, false, false, '{}'::jsonb),
    ('qa-other-workspace', v_other_owner_id, v_other_workspace_id, 'single', 'Other Workspace Card', null, '', null, null, 1, null, null, true, true, '{}'::jsonb),
    ('qa-ambiguous', v_ambiguous_user_id, null, 'single', 'Ambiguous User Card', null, '', null, null, 1, null, null, false, false, '{}'::jsonb);

  insert into public.inventory_label_identities (
    workspace_id,
    inventory_user_id,
    inventory_item_id,
    target_type,
    sku,
    public_enabled
  )
  values
    (v_workspace_id, v_owner_id, 'qa-card-public', 'single', '', true),
    (v_workspace_id, v_owner_id, 'qa-card-disabled', 'single', '', true),
    (v_workspace_id, v_owner_id, 'qa-sealed-public', 'sealed', '', true),
    (v_workspace_id, v_owner_id, 'qa-valid-sku', 'single', v_valid_legacy_sku, false),
    (v_workspace_id, v_owner_id, 'qa-conflict-a', 'single', '', false),
    (v_workspace_id, v_owner_id, 'qa-conflict-b', 'single', '', false),
    (v_workspace_id, v_owner_id, 'qa-blank-sku', 'single', '', false),
    (v_other_workspace_id, v_other_owner_id, 'qa-other-workspace', 'single', '', true);

  select ili.qr_token into v_public_token
  from public.inventory_label_identities ili
  where ili.inventory_user_id = v_owner_id
    and ili.inventory_item_id = 'qa-card-public';

  select ili.qr_token into v_disabled_token
  from public.inventory_label_identities ili
  where ili.inventory_user_id = v_owner_id
    and ili.inventory_item_id = 'qa-card-disabled';

  select ili.qr_token into v_revoked_token
  from public.inventory_label_identities ili
  where ili.inventory_user_id = v_owner_id
    and ili.inventory_item_id = 'qa-sealed-public';

  update public.inventory_label_identities ili
  set status = 'revoked',
      revoked_at = now()
  where ili.qr_token = v_revoked_token;

  select ili.sku into v_generated_blank_sku
  from public.inventory_label_identities ili
  where ili.inventory_user_id = v_owner_id
    and ili.inventory_item_id = 'qa-blank-sku';

  if v_generated_blank_sku !~ '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    raise exception 'blank SKU fixture did not receive a generated Trading Docks SKU';
  end if;

  if not exists (
    select 1
    from public.inventory_label_identities ili
    where ili.inventory_item_id = 'qa-valid-sku'
      and ili.sku = v_valid_legacy_sku
  ) then
    raise exception 'valid legacy SKU was not preserved';
  end if;

  raise notice 'Valid legacy SKU preserved: %', v_valid_legacy_sku;
  raise notice 'Generated blank SKU: %', v_generated_blank_sku;

  insert into public.label_templates (
    workspace_id,
    name,
    category,
    width,
    height,
    unit,
    orientation,
    qr_enabled,
    barcode_enabled,
    price_field,
    pricing_rule,
    template_data
  )
  values
    (v_workspace_id, 'QA Card Show 2x1', 'card_show', 2, 1, 'in', 'landscape', true, true, 'asking_price', '{"mode":"market_percentage","percentage":90,"rounding":"ending_99","minimumPrice":1}'::jsonb, jsonb_build_object('elements', jsonb_build_array('name', 'price', 'qr', 'sku'))),
    (v_workspace_id, 'QA Custom Storage 37x19mm', 'storage', 37, 19, 'mm', 'landscape', true, false, 'none', '{"mode":"none"}'::jsonb, jsonb_build_object('elements', jsonb_build_array('location', 'sku', 'qr'))),
    (v_workspace_id, 'QA Sealed 4x2', 'sealed', 4, 2, 'in', 'landscape', true, true, 'asking_price', '{"mode":"none"}'::jsonb, jsonb_build_object('elements', jsonb_build_array('sealed.product_name', 'price', 'qr')));

  insert into public.label_print_jobs (
    workspace_id,
    template_id,
    status,
    label_count,
    page_count,
    selection_data,
    render_summary,
    retain_until
  )
  select
    v_workspace_id,
    lt.id,
    'preview',
    300,
    3,
    jsonb_build_object('mode', 'card_show', 'selectionCount', 300),
    jsonb_build_object('labels', 300, 'pages', 3),
    now() + interval '14 days'
  from public.label_templates lt
  where lt.workspace_id = v_workspace_id
    and lt.name = 'QA Card Show 2x1';

  insert into public.inventory_price_reviews (
    workspace_id,
    inventory_identity_id,
    inventory_user_id,
    inventory_item_id,
    current_asking_price,
    proposed_asking_price,
    market_price,
    variance_percent,
    status,
    data
  )
  select
    v_workspace_id,
    ili.id,
    v_owner_id,
    'qa-card-public',
    1.99,
    1.49,
    1.63,
    25.1256,
    'pending',
    jsonb_build_object('source', 'qa-seed')
  from public.inventory_label_identities ili
  where ili.inventory_user_id = v_owner_id
    and ili.inventory_item_id = 'qa-card-public';

  select count(*) into v_public_count
  from public.resolve_public_inventory_qr(v_public_token);
  if v_public_count <> 1 then
    raise exception 'enabled public QR did not resolve exactly one row';
  end if;

  if exists (
    select 1
    from public.resolve_public_inventory_qr(v_public_token) public_result
    where to_jsonb(public_result) ?| array[
      'user_id',
      'workspace_id',
      'inventory_item_id',
      'cost_basis',
      'purchase_price',
      'supplier',
      'location',
      'private_notes',
      'customer_id'
    ]
  ) then
    raise exception 'public QR result exposed private fields';
  end if;

  if exists (select 1 from public.resolve_public_inventory_qr(v_disabled_token)) then
    raise exception 'disabled QR resolved unexpectedly';
  end if;

  if exists (select 1 from public.resolve_public_inventory_qr(v_revoked_token)) then
    raise exception 'revoked QR resolved unexpectedly';
  end if;

  if exists (select 1 from public.resolve_public_inventory_qr('not-a-real-token')) then
    raise exception 'invalid QR token resolved unexpectedly';
  end if;

  if public.label_unambiguous_workspace_for_user(v_ambiguous_user_id) is not null then
    raise exception 'ambiguous user resolved to a workspace unexpectedly';
  end if;

  if exists (
    select 1
    from public.inventory_items ii
    where ii.user_id = v_ambiguous_user_id
      and ii.id = 'qa-ambiguous'
      and ii.workspace_id is not null
  ) then
    raise exception 'ambiguous inventory was silently assigned to a workspace';
  end if;

  execute 'set local role authenticated';

  perform set_config('request.jwt.claim.sub', v_member_id::text, true);
  if not exists (
    select 1
    from public.inventory_items ii
    where ii.workspace_id = v_workspace_id
      and ii.id = 'qa-card-public'
  ) then
    raise exception 'member could not read same-workspace inventory';
  end if;

  perform set_config('request.jwt.claim.sub', v_viewer_id::text, true);
  if not exists (
    select 1
    from public.inventory_items ii
    where ii.workspace_id = v_workspace_id
      and ii.id = 'qa-card-public'
  ) then
    raise exception 'viewer could not read same-workspace inventory';
  end if;

  perform set_config('request.jwt.claim.sub', v_other_owner_id::text, true);
  select count(*) into v_denied_count
  from public.inventory_items ii
  where ii.workspace_id = v_workspace_id
    and ii.id = 'qa-card-public';
  if v_denied_count <> 0 then
    raise exception 'cross-workspace inventory read was allowed';
  end if;

  perform set_config('request.jwt.claim.sub', v_member_id::text, true);
  begin
    insert into public.label_templates (
      workspace_id,
      name,
      category,
      width,
      height,
      unit
    )
    values (v_workspace_id, 'QA Member Template Denied', 'single', 2, 1, 'in');
    raise exception 'member role could manage templates';
  exception
    when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);
  insert into public.label_templates (
    workspace_id,
    name,
    category,
    width,
    height,
    unit
  )
  values (v_workspace_id, 'QA Manager Template Allowed', 'single', 2, 1, 'in');

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  if not exists (
    select 1
    from public.label_migration_audit
    where issue_type in ('workspace_ambiguous', 'legacy_sku_conflict', 'legacy_sku_preserved')
  ) then
    raise notice 'Audit table has no backfill rows in this rollback seed because proposal backfill runs before this seed.';
  end if;

  raise notice 'Public QR token for manual staging test: %', v_public_token;
  raise notice 'Disabled QR token for manual staging test: %', v_disabled_token;
  raise notice 'Revoked QR token for manual staging test: %', v_revoked_token;
  raise notice 'Staging QA seed completed successfully. Rolling back fixture data.';
end $$;

rollback;
