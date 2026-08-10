-- Verification for 202608090001_label_studio_inventory_qr_proposal.sql.
-- Run only in a disposable local/staging database after replaying migrations
-- and applying the proposal. This script rolls back its own fixture data.

begin;

do $$
declare
  v_owner_id uuid := '00000000-0000-4000-8000-000000090001';
  v_manager_id uuid := '00000000-0000-4000-8000-000000090002';
  v_member_id uuid := '00000000-0000-4000-8000-000000090003';
  v_viewer_id uuid := '00000000-0000-4000-8000-000000090004';
  v_other_id uuid := '00000000-0000-4000-8000-000000090005';
  v_ambiguous_id uuid := '00000000-0000-4000-8000-000000090006';
  v_active_multi_id uuid := '00000000-0000-4000-8000-000000090007';
  v_invalid_active_single_id uuid := '00000000-0000-4000-8000-000000090008';
  v_invalid_active_multi_id uuid := '00000000-0000-4000-8000-000000090009';
  v_no_workspace_id uuid := '00000000-0000-4000-8000-000000090010';
  v_normal_flow_id uuid := '00000000-0000-4000-8000-000000090011';
  v_workspace_id uuid := '00000000-0000-4000-8000-000000091001';
  v_other_workspace_id uuid := '00000000-0000-4000-8000-000000091002';
  v_ambiguous_workspace_id uuid := '00000000-0000-4000-8000-000000091003';
  v_active_workspace_a_id uuid := '00000000-0000-4000-8000-000000091004';
  v_active_workspace_b_id uuid := '00000000-0000-4000-8000-000000091005';
  v_invalid_single_valid_workspace_id uuid := '00000000-0000-4000-8000-000000091006';
  v_invalid_single_inactive_workspace_id uuid := '00000000-0000-4000-8000-000000091007';
  v_invalid_multi_valid_workspace_a_id uuid := '00000000-0000-4000-8000-000000091008';
  v_invalid_multi_valid_workspace_b_id uuid := '00000000-0000-4000-8000-000000091009';
  v_invalid_multi_inactive_workspace_id uuid := '00000000-0000-4000-8000-000000091010';
  v_normal_flow_workspace_id uuid;
  v_single_identity_id uuid;
  v_sealed_identity_id uuid;
  v_public_qr_token text;
  v_public_rows integer;
  v_generated_sku_count integer;
  v_generated_token_count integer;
  v_preserved_sku text := 'TD-A7K4-92XM';
begin
  if public.label_pgcrypto_schema() is null then
    raise exception 'pgcrypto gen_random_bytes is not resolvable through Label Studio helper';
  end if;

  if length(public.label_crypto_random_bytes(16)) <> 16 then
    raise exception 'Label Studio crypto byte helper returned unexpected length';
  end if;

  with generated as (
    select public.generate_trading_docks_sku() as generated_sku
    from generate_series(1, 50)
  )
  select count(distinct g.generated_sku)
  into v_generated_sku_count
  from generated g
  where g.generated_sku ~ '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$';

  if v_generated_sku_count <> 50 then
    raise exception 'SKU generation did not produce 50 unique formatted SKUs';
  end if;

  with generated as (
    select public.generate_inventory_qr_token() as generated_token
    from generate_series(1, 50)
  )
  select count(distinct g.generated_token)
  into v_generated_token_count
  from generated g
  where g.generated_token ~ '^[A-Za-z0-9_-]{24,96}$';

  if v_generated_token_count <> 50 then
    raise exception 'QR token generation did not produce 50 unique URL-safe tokens';
  end if;

  -- Minimal auth fixture rows. In local Supabase, auth.users has many columns
  -- with defaults; if your local schema differs, create equivalent users first.
  insert into auth.users (id, email)
  values
    (v_owner_id, 'label-owner@example.com'),
    (v_manager_id, 'label-manager@example.com'),
    (v_member_id, 'label-member@example.com'),
    (v_viewer_id, 'label-viewer@example.com'),
    (v_ambiguous_id, 'label-ambiguous@example.com'),
    (v_active_multi_id, 'label-active-multi@example.com'),
    (v_invalid_active_single_id, 'label-invalid-active-single@example.com'),
    (v_invalid_active_multi_id, 'label-invalid-active-multi@example.com'),
    (v_no_workspace_id, 'label-no-workspace@example.com'),
    (v_normal_flow_id, 'label-normal-flow@example.com'),
    (v_other_id, 'label-other@example.com')
  on conflict (id) do nothing;

  select up.active_workspace_id
  into v_normal_flow_workspace_id
  from public.user_preferences up
  where up.user_id = v_normal_flow_id;

  -- Verification fixtures are inserted through auth.users, so the production
  -- public.handle_new_user() trigger legitimately creates a default workspace,
  -- membership, and active preference. Remove those generated defaults for
  -- synthetic states, then configure each resolver case explicitly below.
  delete from public.workspaces w
  where w.owner_id in (
    v_owner_id,
    v_manager_id,
    v_member_id,
    v_viewer_id,
    v_other_id,
    v_ambiguous_id,
    v_active_multi_id,
    v_invalid_active_single_id,
    v_invalid_active_multi_id,
    v_no_workspace_id
  )
    and w.name = 'Trading Docks';

  insert into public.workspaces (id, name, owner_id)
  values
    (v_workspace_id, 'Label Workspace', v_owner_id),
    (v_other_workspace_id, 'Other Workspace', v_other_id),
    (v_ambiguous_workspace_id, 'Ambiguous Workspace', v_ambiguous_id),
    (v_active_workspace_a_id, 'Active Multi Workspace A', v_active_multi_id),
    (v_active_workspace_b_id, 'Active Multi Workspace B', v_active_multi_id),
    (v_invalid_single_valid_workspace_id, 'Invalid Active Single Valid Workspace', v_invalid_active_single_id),
    (v_invalid_single_inactive_workspace_id, 'Invalid Active Single Inactive Workspace', v_invalid_active_single_id),
    (v_invalid_multi_valid_workspace_a_id, 'Invalid Active Multi Valid Workspace A', v_invalid_active_multi_id),
    (v_invalid_multi_valid_workspace_b_id, 'Invalid Active Multi Valid Workspace B', v_invalid_active_multi_id),
    (v_invalid_multi_inactive_workspace_id, 'Invalid Active Multi Inactive Workspace', v_invalid_active_multi_id);

  insert into public.workspace_members (workspace_id, user_id, role)
  values
    (v_workspace_id, v_owner_id, 'owner'),
    (v_workspace_id, v_manager_id, 'manager'),
    (v_workspace_id, v_member_id, 'member'),
    (v_workspace_id, v_viewer_id, 'viewer'),
    (v_other_workspace_id, v_other_id, 'owner'),
    (v_workspace_id, v_ambiguous_id, 'member'),
    (v_ambiguous_workspace_id, v_ambiguous_id, 'member'),
    (v_active_workspace_a_id, v_active_multi_id, 'owner'),
    (v_active_workspace_b_id, v_active_multi_id, 'member'),
    (v_invalid_single_valid_workspace_id, v_invalid_active_single_id, 'owner'),
    (v_invalid_multi_valid_workspace_a_id, v_invalid_active_multi_id, 'owner'),
    (v_invalid_multi_valid_workspace_b_id, v_invalid_active_multi_id, 'member');

  insert into public.user_preferences (user_id, active_workspace_id)
  values
    (v_owner_id, v_workspace_id),
    (v_manager_id, v_workspace_id),
    (v_member_id, v_workspace_id),
    (v_viewer_id, v_workspace_id),
    (v_active_multi_id, v_active_workspace_b_id),
    (v_invalid_active_single_id, v_invalid_single_inactive_workspace_id),
    (v_invalid_active_multi_id, v_invalid_multi_inactive_workspace_id),
    (v_other_id, v_other_workspace_id)
  on conflict (user_id) do update set active_workspace_id = excluded.active_workspace_id;

  -- auth.users fixtures can fire public.handle_new_user(), which creates a
  -- default active workspace. Clear it so this case genuinely has multiple
  -- valid memberships and no explicit active workspace.
  update public.user_preferences up
  set active_workspace_id = null
  where up.user_id in (v_ambiguous_id, v_no_workspace_id);

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
    (
      'single-1',
      v_owner_id,
      v_workspace_id,
      'single',
      'Unblinking Observer',
      null,
      '',
      'MID',
      '82',
      1,
      1.99,
      1.63,
      true,
      true,
      jsonb_build_object('condition', 'Near Mint', 'finish', 'normal', 'costBasis', 0.72, 'privateNotes', 'staff only')
    ),
    (
      'sealed-1',
      v_owner_id,
      v_workspace_id,
      'sealed',
      '',
      'Modern Horizons 3 Bundle',
      '',
      null,
      null,
      4,
      79.99,
      72.50,
      true,
      true,
      '{}'::jsonb
    ),
    (
      'legacy-sku-1',
      v_owner_id,
      v_workspace_id,
      'single',
      'Ledger Shredder',
      null,
      v_preserved_sku,
      'SNC',
      '46',
      1,
      8.99,
      8.20,
      false,
      false,
      '{}'::jsonb
    ),
    (
      'legacy-conflict-1',
      v_owner_id,
      v_workspace_id,
      'single',
      'Conflict One',
      null,
      'TD-ZZZZ-ZZZZ',
      null,
      null,
      1,
      null,
      null,
      false,
      false,
      '{}'::jsonb
    ),
    (
      'legacy-conflict-2',
      v_owner_id,
      v_workspace_id,
      'single',
      'Conflict Two',
      null,
      'TD-ZZZZ-ZZZZ',
      null,
      null,
      1,
      null,
      null,
      false,
      false,
      '{}'::jsonb
    ),
    (
      'ambiguous-1',
      v_ambiguous_id,
      null,
      'single',
      'Ambiguous Inventory',
      null,
      '',
      null,
      null,
      1,
      null,
      null,
      false,
      false,
      '{}'::jsonb
    ),
    (
      'active-multi-1',
      v_active_multi_id,
      null,
      'single',
      'Active Multi Inventory',
      null,
      '',
      null,
      null,
      1,
      null,
      null,
      false,
      false,
      '{}'::jsonb
    ),
    (
      'no-workspace-1',
      v_no_workspace_id,
      null,
      'single',
      'No Workspace Inventory',
      null,
      '',
      null,
      null,
      1,
      null,
      null,
      false,
      false,
      '{}'::jsonb
    );

  insert into public.inventory_label_identities (
    workspace_id,
    inventory_user_id,
    inventory_item_id,
    target_type,
    sku,
    public_enabled
  )
  values
    (v_workspace_id, v_owner_id, 'single-1', 'single', '', true),
    (v_workspace_id, v_owner_id, 'sealed-1', 'sealed', '', true);

  select ili.id, ili.qr_token
  into v_single_identity_id, v_public_qr_token
  from public.inventory_label_identities ili
  where ili.inventory_item_id = 'single-1';

  select ili.id
  into v_sealed_identity_id
  from public.inventory_label_identities ili
  where ili.inventory_item_id = 'sealed-1';

  if v_single_identity_id is null or v_public_qr_token is null then
    raise exception 'expected generated identity and token';
  end if;

  if not exists (
    select 1
    from public.inventory_label_identities ili
    where ili.inventory_item_id = 'single-1'
      and ili.sku ~ '^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$'
      and ili.barcode_value = ili.sku
  ) then
    raise exception 'expected generated Trading Docks SKU and barcode fallback';
  end if;

  insert into public.inventory_label_identities (
    workspace_id,
    inventory_user_id,
    inventory_item_id,
    target_type,
    sku,
    public_enabled
  )
  values
    (v_workspace_id, v_owner_id, 'legacy-sku-1', 'single', v_preserved_sku, false),
    (v_workspace_id, v_owner_id, 'legacy-conflict-1', 'single', '', false),
    (v_workspace_id, v_owner_id, 'legacy-conflict-2', 'single', '', false);

  if not exists (
    select 1
    from public.inventory_label_identities ili
    where ili.inventory_item_id = 'legacy-sku-1'
      and ili.sku = v_preserved_sku
  ) then
    raise exception 'valid unique legacy SKU was not preserved';
  end if;

  if exists (
    select 1
    from public.inventory_label_identities ili
    where ili.inventory_item_id in ('legacy-conflict-1', 'legacy-conflict-2')
      and ili.sku = 'TD-ZZZZ-ZZZZ'
  ) then
    raise exception 'conflicting legacy SKU was preserved unexpectedly';
  end if;

  begin
    insert into public.inventory_label_identities (
      workspace_id,
      inventory_user_id,
      inventory_item_id,
      target_type,
      sku,
      qr_token
    )
    select
      source_identity.workspace_id,
      source_identity.inventory_user_id,
      source_identity.inventory_item_id,
      source_identity.target_type,
      source_identity.sku,
      public.generate_inventory_qr_token()
    from public.inventory_label_identities source_identity
    where source_identity.id = v_single_identity_id;
    raise exception 'duplicate workspace SKU was accepted';
  exception
    when unique_violation then null;
  end;

  select count(*)
  into v_public_rows
  from public.resolve_public_inventory_qr(v_public_qr_token);
  if v_public_rows <> 1 then
    raise exception 'public QR resolver did not return exactly one row';
  end if;

  if exists (
    select 1
    from public.resolve_public_inventory_qr(v_public_qr_token)
    where item_name <> 'Unblinking Observer'
      or card_name <> 'Unblinking Observer'
      or product_name is not null
      or asking_price <> 1.99
      or market_price <> 1.63
  ) then
    raise exception 'public QR resolver returned incorrect sanitized fields';
  end if;

  if exists (
    select 1
    from public.resolve_public_inventory_qr(v_public_qr_token) public_result
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
    raise exception 'public QR resolver exposed private fields';
  end if;

  update public.inventory_label_identities ili
  set public_enabled = false
  where ili.id = v_single_identity_id;
  if exists (select 1 from public.resolve_public_inventory_qr(v_public_qr_token)) then
    raise exception 'disabled public QR identity was still resolvable';
  end if;
  update public.inventory_label_identities ili
  set public_enabled = true
  where ili.id = v_single_identity_id;
  update public.inventory_items ii
  set public_label_enabled = false
  where ii.user_id = v_owner_id
    and ii.id = 'single-1';
  if exists (select 1 from public.resolve_public_inventory_qr(v_public_qr_token)) then
    raise exception 'inventory-level public label flag was ignored';
  end if;
  update public.inventory_items ii
  set public_label_enabled = true
  where ii.user_id = v_owner_id
    and ii.id = 'single-1';
  update public.inventory_label_identities ili
  set public_enabled = true,
      revoked_at = now(),
      status = 'revoked'
  where ili.id = v_single_identity_id;
  if exists (select 1 from public.resolve_public_inventory_qr(v_public_qr_token)) then
    raise exception 'revoked QR identity was still resolvable';
  end if;

  if public.label_unambiguous_workspace_for_user(v_active_multi_id) is distinct from v_active_workspace_b_id then
    raise exception 'multi-workspace user with explicit active workspace did not resolve to active workspace';
  end if;

  if public.label_unambiguous_workspace_for_user(v_owner_id) is distinct from v_workspace_id then
    raise exception 'single-workspace user did not resolve to only workspace';
  end if;

  if public.label_unambiguous_workspace_for_user(v_ambiguous_id) is not null then
    raise exception 'multi-workspace user without active workspace resolved unexpectedly';
  end if;

  if public.label_unambiguous_workspace_for_user(v_invalid_active_single_id) is distinct from v_invalid_single_valid_workspace_id then
    raise exception 'invalid active workspace with one remaining membership did not fall back to only valid workspace';
  end if;

  if public.label_unambiguous_workspace_for_user(v_invalid_active_multi_id) is not null then
    raise exception 'invalid active workspace with multiple remaining memberships resolved unexpectedly';
  end if;

  if public.label_unambiguous_workspace_for_user(v_no_workspace_id) is not null then
    raise exception 'user without valid workspace membership resolved unexpectedly';
  end if;

  if v_normal_flow_workspace_id is null
     or public.label_unambiguous_workspace_for_user(v_normal_flow_id) is distinct from v_normal_flow_workspace_id then
    raise exception 'normal handle_new_user flow did not resolve to generated active workspace';
  end if;

  if exists (
    select 1
    from public.inventory_items ii
    where ii.user_id = v_ambiguous_id
      and ii.id = 'ambiguous-1'
      and ii.workspace_id is not null
  ) then
    raise exception 'ambiguous inventory was silently assigned to a workspace';
  end if;

  if public.label_unambiguous_workspace_for_user(v_active_multi_id) is distinct from v_active_workspace_b_id
     or public.label_unambiguous_workspace_for_user(v_ambiguous_id) is not null
     or public.label_unambiguous_workspace_for_user(v_no_workspace_id) is not null then
    raise exception 'resolver backfill candidates do not match expected workspace mapping safety';
  end if;

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
  values (
    v_workspace_id,
    'Card Show 2x1',
    'card_show',
    2,
    1,
    'in',
    'landscape',
    true,
    true,
    'asking_price',
    '{"mode":"market_percentage","percentage":90,"rounding":"ending_99","minimumPrice":1}'::jsonb,
    jsonb_build_object('elements', jsonb_build_array('name', 'price', 'qr', 'sku'))
  );

  begin
    insert into public.label_templates (
      workspace_id,
      name,
      category,
      width,
      height,
      unit
    )
    values (v_workspace_id, 'Invalid', 'single', 0, 1, 'in');
    raise exception 'invalid label dimensions were accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.label_templates (
      workspace_id,
      name,
      category,
      width,
      height,
      unit
    )
    values (v_workspace_id, 'Huge', 'single', 100, 1, 'in');
    raise exception 'unreasonable label dimensions were accepted';
  exception
    when check_violation then null;
  end;

  insert into public.label_print_jobs (
    workspace_id,
    template_id,
    status,
    label_count,
    page_count,
    selection_data,
    render_summary
  )
  select
    lt.workspace_id,
    id,
    'preview',
    250,
    3,
    jsonb_build_object('mode', 'card_show'),
    jsonb_build_object('labels', 250)
  from public.label_templates lt
  where lt.workspace_id = v_workspace_id
    and lt.name = 'Card Show 2x1'
  limit 1;

  insert into public.inventory_price_reviews (
    workspace_id,
    inventory_identity_id,
    inventory_user_id,
    inventory_item_id,
    current_asking_price,
    proposed_asking_price,
    market_price,
    variance_percent,
    status
  )
  values (
    v_workspace_id,
    v_sealed_identity_id,
    v_owner_id,
    'sealed-1',
    79.99,
    71.99,
    72.50,
    10.0012,
    'pending'
  );

  begin
    insert into public.inventory_price_reviews (
      workspace_id,
      inventory_identity_id,
      inventory_user_id,
      inventory_item_id,
      current_asking_price,
      proposed_asking_price,
      market_price,
      status
    )
    values (
      v_workspace_id,
      v_sealed_identity_id,
      v_owner_id,
      'sealed-1',
      79.99,
      -1,
      72.50,
      'pending'
    );
    raise exception 'negative repricing value was accepted';
  exception
    when check_violation then null;
  end;

  if not exists (
    select 1
    from public.inventory_items ii
    where ii.id = 'sealed-1'
      and ii.item_kind = 'sealed'
      and ii.product_name = 'Modern Horizons 3 Bundle'
  ) then
    raise exception 'sealed inventory item was not represented through inventory_items';
  end if;

  if not exists (
    select 1
    from public.inventory_label_identities ili
    join public.inventory_items ii
      on ii.user_id = ili.inventory_user_id
     and ii.id = ili.inventory_item_id
    where ili.workspace_id = v_workspace_id
      and ii.item_kind in ('single', 'sealed')
  ) then
    raise exception 'identity rows do not resolve to inventory rows';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_member_id::text, true);
  if not exists (
    select 1
    from public.inventory_items ii
    where ii.workspace_id = v_workspace_id
      and ii.id = 'single-1'
  ) then
    raise exception 'workspace member could not read workspace inventory';
  end if;

  perform set_config('request.jwt.claim.sub', v_other_id::text, true);
  if exists (
    select 1
    from public.inventory_items ii
    where ii.workspace_id = v_workspace_id
      and ii.id = 'single-1'
  ) then
    raise exception 'cross-workspace user could read workspace inventory';
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
    values (v_workspace_id, 'Member Cannot Manage', 'single', 2, 1, 'in');
    raise exception 'member role could manage templates';
  exception
    when insufficient_privilege then null;
    when check_violation then raise;
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
  values (v_workspace_id, 'Manager Can Manage', 'single', 2, 1, 'in');
end $$;

rollback;
