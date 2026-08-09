# Inventory QR Architecture

## Current Inventory Audit

- Implemented: `inventory_locations`, `inventory_items`, and `inventory_movements` are created by `supabase/migrations/202607280004_inventory_persistence.sql`.
- Implemented: `inventory_items` currently has `user_id`, `id`, `sku`, `card_name`, `location_id`, `scryfall_id`, `set_code`, `collector_number`, `quantity`, `inventory_value`, and `data`.
- Implemented: RLS on active inventory tables is user-scoped through `auth.uid() = user_id`.
- Partially Implemented: `inventory_items.sku` exists, but there is no enforced uniqueness, QR token table, workspace ownership column, token revocation model, or public-safe route resolver.
- Partially Implemented: Sealed buying and sealed product routes exist, but sealed inventory labels do not yet have a first-class durable product identity in the active schema.
- Planned: Workspace-owned inventory must be resolved before shared Store labeling can be production-authoritative.

## Inventory SKU Contract

- Implemented: `src/lib/label-studio/inventory-identity.ts` defines public-safe Trading Docks SKUs using the format `TD-XXXX-XXXX`.
- Implemented: SKUs are human-readable, QR-compatible, barcode-compatible, and do not encode cost basis, internal IDs, customer data, or workspace secrets.
- Planned: Database uniqueness must be enforced by workspace before production use.

## QR Token Contract

- Implemented: The QR route shape is `/q/{token}`.
- Implemented: Public QR views expose only sanitized product, printing, condition, finish, asking price, market price, SKU, and item name.
- Implemented: Employee QR views require matching workspace context before returning internal actions.
- Planned: The public `/q/{token}` route must be backed by a server resolver after migration approval.

## Required Migration Proposal

Do not apply this without review. A forward-only migration should add:

1. `inventory_identity`
   - `id uuid primary key default gen_random_uuid()`
   - `workspace_id uuid not null references public.workspaces(id)`
   - `user_id uuid references auth.users(id)`
   - `target_type text not null`
   - `inventory_item_id text`
   - `sealed_product_id text`
   - `sku text not null`
   - `qr_token text not null`
   - `qr_token_revoked_at timestamptz`
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`
   - unique `(workspace_id, sku)`
   - unique `(qr_token)`

2. `label_templates`
   - `id uuid primary key default gen_random_uuid()`
   - `workspace_id uuid not null references public.workspaces(id)`
   - `name text not null`
   - `category text not null`
   - `width numeric not null`
   - `height numeric not null`
   - `unit text not null`
   - `orientation text not null`
   - `qr_enabled boolean not null default true`
   - `barcode_enabled boolean not null default false`
   - `logo_enabled boolean not null default false`
   - `price_field text not null default 'asking_price'`
   - `template_data jsonb not null default '{}'::jsonb`
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`
   - index `(workspace_id, category)`

3. `label_print_jobs`
   - `id uuid primary key default gen_random_uuid()`
   - `workspace_id uuid not null references public.workspaces(id)`
   - `template_id uuid references public.label_templates(id)`
   - `created_by uuid not null references auth.users(id)`
   - `status text not null`
   - `item_count integer not null`
   - `job_data jsonb not null default '{}'::jsonb`
   - `created_at timestamptz not null default now()`

4. `inventory_price_reviews`
   - `id uuid primary key default gen_random_uuid()`
   - `workspace_id uuid not null references public.workspaces(id)`
   - `inventory_identity_id uuid references public.inventory_identity(id)`
   - `current_asking_price numeric`
   - `proposed_asking_price numeric`
   - `market_price numeric`
   - `variance_percent numeric`
   - `status text not null default 'pending'`
   - `created_at timestamptz not null default now()`

## Security Rules

- Requires Production Configuration: RLS must deny cross-workspace access to identity, templates, print jobs, and price reviews.
- Requires Production Configuration: Public QR resolution must use a server route that returns sanitized fields only.
- Requires Production Configuration: Employee QR actions must re-check server authority for inventory, storage, POS, audit, and card-show contexts.
- Planned: Token rotation should set `qr_token_revoked_at` and create a replacement token without deleting historical print jobs.

## Mobile QR Mode

- Planned: Mobile scanner should add a QR mode that resolves Trading Docks QR tokens to a context action.
- Planned: QR mode must not touch card recognition architecture.
- Planned: Offline QR scans should queue only authenticated employee actions and must retain workspace isolation.
