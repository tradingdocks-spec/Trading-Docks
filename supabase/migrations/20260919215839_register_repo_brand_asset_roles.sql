-- Allow the existing Asset Vault brand-role constraint to represent the
-- primary repo-owned app icon without changing any asset files or storage.
-- Reviewed artifact only; do not apply remotely as part of this change.

alter table public.marketing_assets drop constraint if exists marketing_assets_brand_role_check;
alter table public.marketing_assets
  add constraint marketing_assets_brand_role_check check (brand_role is null or brand_role in (
    'logo_primary', 'logo_wordmark', 'logo_icon', 'logo_light', 'logo_dark', 'logo_monochrome',
    'app_icon_primary', 'product_chaos_sort_primary', 'product_inventory_primary', 'product_orders_primary',
    'background_editorial_01', 'background_dark_texture_01'
  ));
