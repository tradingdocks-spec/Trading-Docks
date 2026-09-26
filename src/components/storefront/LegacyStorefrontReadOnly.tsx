import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/showcase";

// Explicit operational rollback only. No legacy analytics, requests, reservations,
// carts, payments or mutations are mounted by this server-rendered read path.
export async function LegacyStorefrontReadOnly({ slug, query = "" }: { slug: string; query?: string }) {
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase.from("showcase_profiles")
    .select("slug,display_name,show_prices").eq("slug", slug).eq("enabled", true).maybeSingle();
  if (profileError) throw new Error("Store inventory is temporarily unavailable.");
  if (!profile) notFound();
  const { data, error } = await supabase.rpc("get_public_showcase_inventory", {
    requested_slug: slug, search_query: query || null, page_size: 48, page_offset: 0,
  });
  if (error) throw new Error("Store inventory is temporarily unavailable.");
  const cards = (data ?? []) as { public_id: string; name: string; set_code: string | null;
    collector_number: string | null; game: string; public_price: number | null }[];
  const visible = cards.filter((card) => typeof card.public_price === "number" && card.public_price > 0);
  return <main className="min-h-screen bg-[#071017] px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-5xl">
      <a href="/shop" className="text-cyan-200">Store home</a>
      <h1 className="mt-4 text-3xl font-semibold">{profile.display_name}</h1>
      <p className="mt-3 text-sm text-white/60">Browse our catalog. Cart planning is temporarily unavailable.</p>
      <form method="get" className="my-6 flex gap-2">
        <label className="min-w-0 flex-1">Search inventory
          <input name="q" defaultValue={query} className="mt-2 block min-h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3" />
        </label>
        <button className="min-h-11 self-end rounded-lg bg-cyan-300 px-4 text-slate-950">Search</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">{visible.map((card) => <article key={card.public_id} className="rounded-xl border border-white/15 p-4">
        <h2 className="font-semibold">{card.name}</h2>
        <p className="mt-2 text-sm text-white/60">{card.game} · {card.set_code} · {card.collector_number}</p>
        <p className="mt-3 text-cyan-200">{profile.show_prices ? money(card.public_price) : "Price hidden"}</p>
      </article>)}</div>
      {!visible.length ? <p>No cards match this search.</p> : <p className="mt-4 text-sm text-white/60">Showing up to 48 matches. Refine your search to find a card.</p>}
    </div>
  </main>;
}
