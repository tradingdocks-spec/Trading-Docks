import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

import { requireServerCapability } from "@/lib/platform/server-access";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export default async function CollectionPurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireServerCapability("buying.manage", "/dashboard/plans");
  const { data: purchase, error } = await supabase
    .from("collection_purchases")
    .select("id,intake_id,seller_name,seller_contact,purchase_amount,calculated_max_offer,market_value,sellable_value,expected_profit,roi_percent,margin_percent,total_quantity,unique_lines,valuation,scenario,notes,completed_at")
    .eq("id", decodeURIComponent(id))
    .maybeSingle();

  if (error || !purchase) notFound();

  const purchaseRow = objectRecord(purchase);
  const intakeId = text(purchaseRow.intake_id);
  const { data: items } = await supabase
    .from("collection_intake_items")
    .select("id,card_name,set_code,collector_number,condition,finish,language,quantity,unit_market_value,allocated_total_cost,allocated_unit_cost,inventory_item_id,review_state")
    .eq("intake_id", intakeId)
    .order("created_at", { ascending: true });

  const rows = Array.isArray(items) ? items.map(objectRecord) : [];

  return (
    <main className="min-h-screen bg-[#05070b] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/dashboard/collection-buying" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 hover:text-cyan-100">
          <ArrowLeft className="h-4 w-4" />
          Back to Collection Intake
        </Link>

        <header className="mt-5 rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                <ClipboardCheck className="h-4 w-4" />
                Completed collection purchase
              </p>
              <h1 className="mt-3 text-2xl font-black text-slate-50 sm:text-3xl">
                {text(purchaseRow.seller_name) || "Walk-in collection"}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Completed {text(purchaseRow.completed_at) ? new Date(text(purchaseRow.completed_at)).toLocaleString() : "recently"}. Realized resale ROI is not shown until downstream sales exist.
              </p>
            </div>
            <div className="rounded-2xl bg-cyan-300/[0.08] px-5 py-4 text-right">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-200">Paid</p>
              <p className="mt-1 text-3xl font-black text-slate-50">{money(purchaseRow.purchase_amount)}</p>
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-4">
          <Metric label="Market value" value={money(purchaseRow.market_value)} />
          <Metric label="Calculated max offer" value={money(purchaseRow.calculated_max_offer)} />
          <Metric label="Expected profit" value={money(purchaseRow.expected_profit)} />
          <Metric label="Lines / cards" value={`${purchaseRow.unique_lines ?? 0} / ${purchaseRow.total_quantity ?? 0}`} />
        </section>

        <section className="mt-5 overflow-x-auto rounded-[22px] border border-white/[0.08] bg-white/[0.04]">
          <table className="min-w-[920px] w-full border-collapse text-left">
            <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Printing</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Allocated cost</th>
                <th className="px-4 py-3">Inventory link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((item) => (
                <tr key={text(item.id)}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-100">{text(item.card_name) || "Unknown item"}</p>
                    <p className="mt-1 text-xs text-slate-500">{text(item.condition) || "Unknown condition"} / {text(item.finish) || "Unknown finish"} / {text(item.language) || "English"}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300">{text(item.set_code) || "n/a"} #{text(item.collector_number) || "n/a"}</td>
                  <td className="px-4 py-3 text-sm font-bold">{String(item.quantity ?? 0)}</td>
                  <td className="px-4 py-3 text-sm">{money(item.unit_market_value)}</td>
                  <td className="px-4 py-3 text-sm">
                    <p>{money(item.allocated_total_cost)}</p>
                    <p className="text-xs text-slate-500">{money(item.allocated_unit_cost)} / unit</p>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {text(item.inventory_item_id) ? (
                      <Link href={`/dashboard/cards/${encodeURIComponent(text(item.inventory_item_id))}`} className="font-semibold text-cyan-200 hover:text-cyan-100">
                        Open inventory row
                      </Link>
                    ) : (
                      <span className="text-slate-500">Not linked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-50">{value}</p>
    </div>
  );
}
