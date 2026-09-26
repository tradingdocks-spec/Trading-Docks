import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontExperience } from "@/components/storefront/StorefrontExperience";
import { getStorefrontCatalog } from "@/lib/showcase";
import { buildStorefrontQuery, parseStorefrontQuery } from "@/lib/storefront/query";
import { LegacyStorefrontReadOnly } from "@/components/storefront/LegacyStorefrontReadOnly";

export const metadata: Metadata = {
  title: "Trading Docks Store",
  description: "Browse Trading Docks card inventory.",
};

export default async function StorefrontPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseStorefrontQuery(await searchParams);
  if (process.env.STOREFRONT_READ_MODE === "legacy") {
    return <LegacyStorefrontReadOnly slug="trading-docks" query={query.q} />;
  }
  // /shop is the initial Trading Docks-owned store alias; /s/[storeSlug] uses
  // the same forward-only, read-only catalog contract.
  const store = await getStorefrontCatalog("trading-docks", query.q, query.filters, query.sort, 24, (query.page - 1) * 24);
  if (!store) notFound();

  const pageCount = Math.max(1, Math.ceil(store.total / 24));
  const previousQuery = buildStorefrontQuery(query, Math.max(1, query.page - 1));
  const nextQuery = buildStorefrontQuery(query, Math.min(pageCount, query.page + 1));
  return (
    <StorefrontExperience
      store={store.profile}
      cards={store.cards}
      total={store.total}
      facets={store.facets}
      cartStoreSlug={store.profile.slug}
      previousHref={query.page > 1 ? "/shop?" + previousQuery : null}
      nextHref={query.page < pageCount ? "/shop?" + nextQuery : null}
      page={query.page}
      pageCount={pageCount}
      query={query}
    />
  );
}
