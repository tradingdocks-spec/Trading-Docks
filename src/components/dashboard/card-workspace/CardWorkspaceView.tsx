import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ImageIcon, Layers3, MapPin, Pencil, ShieldAlert } from "lucide-react";

import { money, type CardWorkspaceData } from "@/lib/card-workspace";

export function CardWorkspaceView({ data }: { data: CardWorkspaceData }) {
  return (
    <main className="min-h-screen bg-[#020911] px-4 py-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <Link href="/dashboard/inventory" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100">
          <ArrowLeft className="h-4 w-4" />
          Collection
        </Link>

        <section className="grid gap-4 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[28px] bg-[#07141e] shadow-[0_26px_110px_rgba(0,0,0,.42)] ring-1 ring-white/[0.07]">
            {data.identity.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.identity.imageUrl} alt={`${data.identity.cardName} card image`} className="aspect-[0.716] h-full w-full object-cover" />
            ) : (
              <div className="flex aspect-[0.716] flex-col items-center justify-center gap-3 bg-white/[0.025] text-slate-500">
                <ImageIcon className="h-10 w-10" />
                <span className="text-sm font-semibold">Image unavailable</span>
              </div>
            )}
          </div>

          <div className="rounded-[30px] bg-[#06131d] p-5 shadow-[0_22px_90px_rgba(0,0,0,.28)] ring-1 ring-white/[0.07] sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/80">{data.printing.display}</p>
                <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">{data.identity.cardName}</h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {[data.printing.setName, data.printing.collectorNumber ? `#${data.printing.collectorNumber}` : null, data.printing.language, data.printing.finish]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="rounded-2xl bg-cyan-300/[0.08] px-4 py-3 text-left ring-1 ring-cyan-300/[0.16] lg:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200/75">Current price</p>
                <p className="mt-1 text-3xl font-semibold tracking-[-0.045em] text-cyan-50">{data.market.valueLabel}</p>
                <p className="mt-1 text-xs text-cyan-100/55">{data.market.valueSource === "inventory" ? "Saved inventory valuation" : "Valuation unavailable"}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <Metric label="Owned" value={data.userPosition.quantityOwned.toLocaleString()} detail={data.userPosition.lotCount === 1 ? "1 inventory lot" : `${data.userPosition.lotCount} inventory lots`} />
              <Metric label="Current value" value={money(data.market.totalValue)} detail="Quantity x unit valuation" />
              <Metric label="Average cost" value={data.userPosition.averageKnownCost === null ? "Unavailable" : money(data.userPosition.averageKnownCost)} detail={data.userPosition.costBasisCoverageLabel} />
              <Metric label="Gain / loss" value={data.userPosition.unrealizedGain === null ? "Unavailable" : money(data.userPosition.unrealizedGain)} detail="Only when cost and value exist" />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {data.actions.map((action) => (
                <Link key={action.label} href={action.href} className={actionClass(action.priority)}>
                  {action.priority === "primary" ? <Pencil className="h-4 w-4" /> : null}
                  {action.label}
                  {action.priority !== "primary" ? <ArrowRight className="h-4 w-4" /> : null}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
          <div className="space-y-4">
            <Panel title="Your Position" eyebrow={data.userPosition.ownedLabel}>
              <div className="space-y-2">
                {data.inventoryRecords.map((record) => (
                  <article key={record.id} className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06] transition hover:bg-white/[0.05]">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_100px_130px_120px] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{record.condition} · {record.finish}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> {record.location}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-200">Qty {record.quantity}</p>
                      <p className="text-sm text-slate-400">{record.totalValue === null ? "Value unavailable" : money(record.totalValue)}</p>
                      <Link href={record.editHref} className="inline-flex h-9 items-center justify-center rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100">Edit</Link>
                    </div>
                    {record.attentionTypes.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {record.attentionTypes.map((type) => (
                          <span key={type} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-300/[0.08] px-2.5 py-1.5 text-[11px] font-semibold text-amber-100">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            {attentionLabel(type)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Other Printings" eyebrow={`${data.otherPrintings.length} bounded examples`}>
              {data.otherPrintings.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {data.otherPrintings.map((printing) => (
                    <a key={printing.id} href={printing.href ?? "#"} target={printing.href ? "_blank" : undefined} rel="noreferrer" className="group overflow-hidden rounded-2xl bg-white/[0.035] ring-1 ring-white/[0.06] transition hover:ring-cyan-300/20">
                      {printing.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={printing.imageUrl} alt={`${printing.name} printing`} className="aspect-[0.716] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[0.716] items-center justify-center text-slate-600"><ImageIcon className="h-7 w-7" /></div>
                      )}
                      <div className="p-3">
                        <p className="truncate text-xs font-semibold text-white">{printing.setCode ?? "Set"} {printing.collectorNumber ? `#${printing.collectorNumber}` : ""}</p>
                        <p className="mt-1 text-xs text-slate-500">{money(printing.price)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyLine text="Other printing data is unavailable for this card in the current trusted sources." />
              )}
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="Market" eyebrow="Truthful pricing only">
              <InfoRow label="Unit value" value={data.market.valueLabel} />
              <InfoRow label="Total position value" value={money(data.market.totalValue)} />
              <InfoRow label="Source" value={data.market.valueSource === "inventory" ? "inventory_items" : "Unavailable"} />
              <InfoRow label="Updated" value={data.market.timestamp ? new Date(data.market.timestamp).toLocaleDateString("en-US") : "Timestamp unavailable"} />
            </Panel>

            <Panel title="Financial Position" eyebrow={data.userPosition.costBasisCompleteness === "known" ? "Known cost basis" : data.userPosition.costBasisCompleteness === "partial" ? "Partial cost basis" : "Cost basis missing"}>
              <InfoRow label="Known coverage" value={data.userPosition.costBasisCoverageLabel} />
              <InfoRow label="Weighted average cost" value={data.userPosition.averageKnownCost === null ? "Unavailable" : money(data.userPosition.averageKnownCost)} />
              <InfoRow label="Known total cost" value={money(data.userPosition.totalCostBasis)} />
              <InfoRow label="Unrealized gain/loss" value={data.userPosition.unrealizedGain === null ? "Unavailable" : money(data.userPosition.unrealizedGain)} />
            </Panel>

            <Panel title="Selling" eyebrow={data.selling.listedQuantity > 0 ? `${data.selling.listedQuantity} listed` : "No active listing data"}>
              {data.selling.listings.length ? data.selling.listings.map((listing) => (
                <InfoRow key={listing.id} label={listing.marketplace} value={`${listing.status} · ${listing.quantity ?? 0} @ ${money(listing.price)}`} />
              )) : <EmptyLine text="No user-scoped listing mapping is attached to this inventory record." />}
            </Panel>

            <Panel title="Deck Context" eyebrow={data.decks.length ? `Used in ${data.decks.length}` : "No deck usage found"}>
              {data.decks.length ? data.decks.map((deck) => (
                <Link key={deck.id} href={deck.href} className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2 text-sm last:border-b-0">
                  <span className="truncate font-semibold text-slate-200">{deck.name}</span>
                  <span className="text-xs text-slate-500">x{deck.quantity}</span>
                </Link>
              )) : <EmptyLine text="No bounded Deck Vault references were found for this card name." />}
            </Panel>

            <Panel title="Inventory History" eyebrow={data.history.available ? `${data.history.events.length} recent events` : "Ledger unavailable"}>
              {data.history.available && data.history.events.length ? data.history.events.map((event) => (
                <InfoRow
                  key={event.id}
                  label={eventLabel(event.eventType)}
                  value={`${eventDetail(event)} · ${new Date(event.occurredAt).toLocaleDateString("en-US")}`}
                />
              )) : <EmptyLine text={data.history.unavailableReason ?? "No inventory events have been recorded for this card yet."} />}
            </Panel>

            <Panel title="Identifiers" eyebrow="Exact printing">
              <InfoRow label="Scryfall" value={data.printing.scryfallId ?? "Unavailable"} />
              <InfoRow label="TCGplayer product" value={data.printing.tcgplayerProductId?.toString() ?? "Unavailable"} />
              <InfoRow label="TCGplayer SKU" value={data.printing.tcgplayerSkuId?.toString() ?? "Unavailable"} />
            </Panel>

            <Panel title="Performance Boundary" eyebrow="Bounded request">
              <InfoRow label="Inventory lots loaded" value={`${data.queryStrategy.inventoryRowsLoaded} / ${data.queryStrategy.inventoryRowsTotal}`} />
              <InfoRow label="Other printings" value={data.queryStrategy.relatedPrintingsLoaded.toString()} />
            </Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <section className="rounded-[26px] bg-[#06131d] p-5 ring-1 ring-white/[0.07]">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white">{title}</h2>
        </div>
        <Layers3 className="h-4 w-4 text-slate-600" />
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] py-2 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[210px] break-words text-right font-semibold text-slate-200">{value}</span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-2xl bg-white/[0.025] p-4 text-xs leading-5 text-slate-500">{text}</p>;
}

function actionClass(priority: "primary" | "secondary" | "tertiary") {
  const base = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60";
  if (priority === "primary") return `${base} bg-cyan-300 text-[#001018] hover:bg-cyan-200`;
  if (priority === "secondary") return `${base} border border-white/[0.08] text-slate-200 hover:border-cyan-300/30 hover:text-cyan-100`;
  return `${base} text-slate-500 hover:text-slate-200`;
}

function attentionLabel(type: string) {
  if (type === "missing_price") return "Missing price";
  if (type === "missing_storage_location") return "Missing storage";
  if (type === "missing_cost_basis") return "Missing cost basis";
  if (type === "unknown_condition") return "Unknown condition";
  if (type === "unknown_finish") return "Unknown finish";
  return "Needs attention";
}

function eventLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventDetail(event: { eventType: string; quantityBefore: number | null; quantityChange: number | null; quantityAfter: number | null; previousValue: string | null; nextValue: string | null; previousLocationId: string | null; nextLocationId: string | null; source: string }) {
  if (event.eventType === "condition_changed" || event.eventType === "finish_changed" || event.eventType === "cost_basis_changed") {
    return `${event.previousValue ?? "Unset"} to ${event.nextValue ?? "Unset"}`;
  }
  if (event.eventType === "location_changed") {
    return `${event.previousValue ?? event.previousLocationId ?? "Unassigned"} to ${event.nextValue ?? event.nextLocationId ?? "Unassigned"}`;
  }
  if (event.eventType === "inventory_created" || event.eventType === "imported") {
    return `Created with ${event.quantityAfter ?? event.quantityChange ?? 0}`;
  }
  return event.quantityChange === null ? "Qty unchanged" : signedQuantity(event.quantityChange);
}

function signedQuantity(value: number) {
  return value > 0 ? `+${value}` : value.toString();
}
