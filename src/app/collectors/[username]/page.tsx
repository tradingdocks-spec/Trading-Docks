import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CircleDollarSign, Globe2, Layers3, MessageCircle, Share2, Star } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

type DataRow = { data: Record<string, unknown> };

export default async function PublicCollectorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("collector_profiles").select("*").eq("username", username).eq("is_public", true).maybeSingle();
  if (!profile) notFound();

  const { data: binders } = await admin.from("portfolio_binders").select("*").eq("user_id", profile.user_id).eq("visibility", "public").order("portfolio_order");
  const locationIds = (binders ?? []).map((binder) => binder.location_id);
  const [{ data: locationRows }, { data: itemRows }] = await Promise.all([
    admin.from("inventory_locations").select("id,data").eq("user_id", profile.user_id).in("id", locationIds.length ? locationIds : ["__none__"]),
    admin.from("inventory_items").select("data").eq("user_id", profile.user_id).in("location_id", locationIds.length ? locationIds : ["__none__"]),
  ]);

  const items = ((itemRows ?? []) as DataRow[]).map((row) => row.data);
  const views = (binders ?? []).map((binder) => {
    const cards = items.filter((item) => item.locationId === binder.location_id);
    return {
      ...binder,
      cardCount: cards.reduce((sum, card) => sum + (typeof card.quantity === "number" ? card.quantity : 1), 0),
      value: cards.reduce((sum, card) => sum + (typeof card.value === "number" ? card.value : 0), 0),
      preview: cards.filter((card) => typeof card.imageUrl === "string").slice(0, 4),
    };
  });
  const totalCards = views.reduce((sum, binder) => sum + binder.cardCount, 0);
  const totalValue = views.reduce((sum, binder) => sum + binder.value, 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.16),transparent_32%),radial-gradient(circle_at_top_left,rgba(34,211,238,.10),transparent_32%),#020911] px-4 py-7 text-white sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative overflow-hidden rounded-[32px] border border-violet-300/[0.17] bg-[linear-gradient(135deg,#0b1e2c,#071522_52%,#160d28)] p-7 shadow-[0_38px_140px_rgba(0,0,0,.48)] sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet-500/[0.18] blur-[120px]" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.17] bg-cyan-300/[0.055] px-3 py-2 text-[10px] font-semibold text-cyan-100"><Globe2 className="h-4 w-4" /> Trading Docks Collector Portfolio</span>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">{profile.display_name}</h1>
              <p className="mt-2 text-sm font-semibold text-violet-200">@{profile.username}</p>
              {profile.bio ? <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">{profile.bio}</p> : null}
              {profile.show_location && profile.location ? <p className="mt-3 text-[11px] text-slate-600">{profile.location}</p> : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={Layers3} label="Cards" value={String(totalCards)} />
              <Stat icon={BookOpen} label="Binders" value={String(views.length)} />
              <Stat icon={CircleDollarSign} label="Value" value={profile.show_collection_value ? money(totalValue) : "Private"} />
            </div>
          </div>
        </header>

        <section className="mt-6">
          <div className="flex items-end justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300">Public bookshelf</p><h2 className="mt-2 text-2xl font-semibold text-white">Featured collections</h2></div><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[10px] font-semibold text-white"><Share2 className="h-4 w-4" /> Share profile</button></div>
          {views.length ? <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{views.map((binder) => <Link key={binder.id} href={`/collectors/${profile.username}/${binder.slug}`} className="group"><div className="relative aspect-[.76] overflow-hidden rounded-[24px] border border-white/[0.13] shadow-[0_26px_68px_rgba(0,0,0,.42)] transition duration-300 group-hover:-translate-y-1.5" style={{ background: `radial-gradient(circle at 70% 10%,${binder.accent_color}33,transparent 34%),linear-gradient(145deg,${binder.cover_color},#020617)` }}><div className="absolute inset-y-0 left-0 w-5 bg-black/25" /><div className="absolute inset-0 flex flex-col justify-between p-5"><div className="flex justify-between"><span className="rounded-full border border-white/[0.13] bg-black/20 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-white/70">{binder.is_trade_binder ? "Trade Binder" : "Collector Vault"}</span>{binder.is_featured ? <Star className="h-4 w-4 fill-amber-300 text-amber-300" /> : null}</div><div><p className="text-xl font-semibold leading-tight text-white">{binder.title}</p><p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-white/45">{binder.cardCount} cards · {profile.show_collection_value && binder.show_values ? money(binder.value) : "Value private"}</p></div></div></div><div className="mt-3 flex items-start justify-between"><div><p className="text-sm font-semibold text-white">{binder.title}</p><p className="mt-1 text-[10px] text-slate-600">{binder.description || "Open the collection"}</p></div>{binder.is_trade_binder ? <MessageCircle className="h-4 w-4 text-emerald-300" /> : null}</div></Link>)}</div> : <div className="mt-6 rounded-[26px] border border-dashed border-white/[0.10] p-12 text-center text-slate-600">No public binders yet.</div>}
        </section>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Layers3; label: string; value: string }) { return <div className="min-w-[108px] rounded-2xl border border-white/[0.08] bg-black/20 p-3"><Icon className="h-4 w-4 text-cyan-300" /><p className="mt-3 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></div>; }
function money(value: number) { return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }
