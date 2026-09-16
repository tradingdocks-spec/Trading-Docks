import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicQrRow = {
  token: string;
  sku: string;
  target_type: string;
  item_name: string;
  card_name: string | null;
  product_name: string | null;
  set_code: string | null;
  collector_number: string | null;
  condition: string | null;
  finish: string | null;
  asking_price: number | string | null;
  market_price: number | string | null;
};

export default async function PublicQrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{24,96}$/.test(token)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_public_inventory_qr", { input_token: token });
  if (error) throw new Error(error.message);
  const item = Array.isArray(data) ? data[0] as PublicQrRow | undefined : undefined;
  if (!item) notFound();

  return (
    <main className="min-h-screen bg-td-canvas px-5 py-10 text-td-primary">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-td-accent/20 bg-td-ink/[0.04] p-6 shadow-2xl shadow-cyan-950/20">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-td-accent-text">Trading Docks QR</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{item.item_name}</h1>
        <div className="mt-6 grid gap-3 text-sm text-td-secondary">
          {item.card_name ? <Fact label="Card" value={item.card_name} /> : null}
          {item.product_name ? <Fact label="Product" value={item.product_name} /> : null}
          {[item.set_code, item.collector_number ? `#${item.collector_number}` : null].filter(Boolean).length ? (
            <Fact label="Printing" value={[item.set_code, item.collector_number ? `#${item.collector_number}` : null].filter(Boolean).join(" ")} />
          ) : null}
          {[item.condition, item.finish].filter(Boolean).length ? (
            <Fact label="State" value={[item.condition, item.finish].filter(Boolean).join(" / ")} />
          ) : null}
          <Fact label="SKU" value={item.sku} />
          <Fact label="Asking price" value={money(item.asking_price)} />
          <Fact label="Market price" value={money(item.market_price)} />
        </div>
        <p className="mt-6 text-xs leading-5 text-td-muted">
          Public QR results show approved label fields only. Private inventory details, workspace identifiers,
          purchase cost, suppliers, storage locations, and notes are not exposed.
        </p>
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-td-ink/[0.07] bg-black/20 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-td-muted">{label}</p>
      <p className="mt-1 font-semibold text-td-primary">{value}</p>
    </div>
  );
}

function money(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}
