-- Read-only health check. Legacy NULL batches are findings, not silently exempted.
select 'inventory_rows' as check_name,count(*)::bigint as actual from public.inventory_items
union all select 'inventory_quantity',sum(quantity) from public.inventory_items
union all select 'inventory_without_workspace',count(*) from public.inventory_items where workspace_id is null
union all select 'inventory_orphan_workspace',count(*) from public.inventory_items i left join public.workspaces w on w.id=i.workspace_id where i.workspace_id is not null and w.id is null
union all select 'batches_without_workspace',count(*) from public.chaos_sort_batches where workspace_id is null
union all select 'albums_without_workspace',count(*) from public.chaos_scan_albums where workspace_id is null
union all select 'batch_orphan_workspace',count(*) from public.chaos_sort_batches b left join public.workspaces w on w.id=b.workspace_id where b.workspace_id is not null and w.id is null
union all select 'album_orphan_workspace',count(*) from public.chaos_scan_albums a left join public.workspaces w on w.id=a.workspace_id where w.id is null
union all select 'cross_workspace_positions',count(*) from public.chaos_sort_inventory_positions p join public.inventory_items i on i.id=p.item_id and i.user_id=p.user_id join public.chaos_sort_batches b on b.id=p.batch_id where b.workspace_id is not null and (b.workspace_id is distinct from i.workspace_id or b.user_id<>p.user_id)
union all select 'orphan_positions',count(*) from public.chaos_sort_inventory_positions p left join public.inventory_items i on i.id=p.item_id and i.user_id=p.user_id left join public.chaos_sort_batches b on b.id=p.batch_id where i.id is null or b.id is null
union all select 'capture_parent_mismatch',count(*) from public.chaos_scan_captures c left join public.chaos_scan_albums a on a.id=c.album_id where a.id is null or a.user_id<>c.user_id
union all select 'album_batch_mismatch',count(*) from public.chaos_scan_albums a left join public.chaos_sort_batches b on b.id=a.id where b.id is null or b.workspace_id is distinct from a.workspace_id or b.user_id<>a.user_id
union all select 'inventory_owner_workspace_mismatch',count(*) from public.inventory_items i where not exists(select 1 from public.workspaces w join public.workspace_members m on m.workspace_id=w.id and m.user_id=i.user_id where w.id=i.workspace_id and ((w.owner_id=i.user_id and m.role='owner') or m.role='manager'));
