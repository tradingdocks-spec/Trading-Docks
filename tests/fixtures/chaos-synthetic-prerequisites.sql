-- Synthetic surrounding tables; not a production restore. No data from hosted databases.
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table auth.users(id uuid primary key,banned_until timestamptz);
    create table public.workspaces(id uuid primary key,owner_id uuid);
    create table public.workspace_members(workspace_id uuid,user_id uuid,role text);
    create table public.user_preferences(user_id uuid primary key,active_workspace_id uuid);
    create table public.inventory_locations(id text,user_id uuid,name text);
    create table public.inventory_items(user_id uuid,id text,quantity integer,workspace_id uuid,
      card_name text,sku text,location_id text,scryfall_id text,set_code text,collector_number text,
      inventory_value numeric,data jsonb,updated_at timestamptz,primary key(user_id,id));
    create type public.inventory_event_type as enum('inventory_created','quantity_added');
    create type public.inventory_event_source as enum('scanner');
    create table public.inventory_events(user_id uuid,inventory_item_id text,quantity_change integer,
      workspace_id uuid,event_type public.inventory_event_type,source public.inventory_event_source,
      related_entity_type text,related_entity_id text,quantity_before integer,quantity_after integer,
      next_location_id text,card_name text,game_id text,scryfall_id text,set_code text,collector_number text,
      condition text,finish text,language text,idempotency_key text,metadata jsonb);
    create table public.selling_inventory_allocations(user_id uuid,inventory_item_id text,quantity integer);
    create table public.chaos_sort_inventory_positions(id text,user_id uuid,batch_id uuid,item_id text,quantity integer,
      card_name text,scryfall_id text,set_code text,collector_number text,finish text,condition text,
      language text,location_id text,updated_at timestamptz,primary key(user_id,id));
    create table public.chaos_sort_sessions(id uuid primary key default gen_random_uuid(),user_id uuid,
      session_code text,source text,target_batch_size integer,status text default 'active');
    create table public.chaos_sort_items(id text,batch_id uuid);
    create table public.chaos_sort_batches(id uuid primary key,user_id uuid,workspace_id uuid,batch_code text,
      title text,status text,status_v2 text,destination_location_id text,destination_label text,
      target_quantity integer,initial_quantity integer,current_quantity integer,source_count integer,
      acquisition_cost numeric,sort_plan jsonb,created_at timestamptz default now(),completed_at timestamptz,
      updated_at timestamptz,session_id uuid,confirmed_count integer,closed_at timestamptz);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert on storage.objects to authenticated;
    grant select on all tables in schema public to authenticated;
