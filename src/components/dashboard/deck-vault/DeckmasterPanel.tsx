"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  applyDeckChangeProposal,
  createDeckChangeProposal,
  inspectDeck,
  inspectCollection,
  type DeckChangeProposal,
} from "@/lib/deckmaster/actions";
import { deckFormatToArchitectFormat } from "@/lib/deck-suite/domain";
import type { DeckCard, DeckRecord, ScryfallCardResult } from "@/lib/deck-vault/types";

const QUICK_ACTIONS = [
  "Finish My Deck", "Improve Mana", "Add Card Draw", "Add Interaction",
  "Lower Price", "Use More Owned Cards", "Find Replacements", "Check Weaknesses",
];

export function DeckmasterPanel({ deck, collection, onApply, mobileOpen, onMobileClose }: {
  deck: DeckRecord;
  collection: Array<{ name: string; quantity: number }>;
  onApply: (deck: DeckRecord) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const context = inspectCollection(inspectDeck(deck), collection);
  const [input, setInput] = useState("");
  const [proposal, setProposal] = useState<DeckChangeProposal | null>(null);
  const [message, setMessage] = useState("I’m connected to this working deck. Every change will be checked by Trading Docks rules before you can apply it.");
  const [busy, setBusy] = useState(false);

  async function submit(command = input) {
    const trimmed = command.trim();
    if (!trimmed) return;
    setInput(trimmed);
    setProposal(null);
    const direct = trimmed.match(/^(add|remove)\s+(.+?)(?:\s+x?(\d+))?$/i);
    if (!direct) {
      setMessage(`Deckmaster has ${context.cards.reduce((sum, card) => sum + card.quantity, 0)} cards from “${context.deckName}” in context. Recommendation generation for “${trimmed}” will use the preserved strategy providers; no unverified card changes were created.`);
      return;
    }

    const operation = direct[1].toLowerCase();
    const cardName = direct[2].trim();
    const quantity = Math.max(1, Number(direct[3] ?? 1));
    if (operation === "remove") {
      const card = deck.cards.find((item) => item.name.toLowerCase() === cardName.toLowerCase());
      if (!card) { setMessage(`${cardName} is not in this deck.`); return; }
      setProposal(createDeckChangeProposal(deck, {
        additions: [], removals: [{ card, quantity, reason: "Requested by you." }], swaps: [],
        explanation: `Remove ${quantity} ${card.name}.`,
      }));
      setMessage("I prepared a reviewable change. The deck has not been modified.");
      return;
    }

    setBusy(true);
    try {
      const params = new URLSearchParams({ q: `!\"${cardName}\"` });
      const response = await fetch(`/api/deck-vault/card-search?${params.toString()}`);
      const payload = await response.json() as { results?: ScryfallCardResult[] };
      const result = payload.results?.find((item) => item.name.toLowerCase() === cardName.toLowerCase());
      if (!result) { setMessage(`I could not resolve an exact card named “${cardName}”. Nothing changed.`); return; }
      const formatId = deckFormatToArchitectFormat(deck.format);
      const card: DeckCard = {
        id: result.id, name: result.name, quantity, manaValue: result.manaValue,
        colors: result.colorIdentity.length ? result.colorIdentity : result.colors,
        typeLine: result.typeLine, category: categoryFor(result.typeLine), price: result.price,
        owned: false, ownedQuantity: 0, image: result.image, artCrop: result.artCrop,
        setCode: result.setCode, collectorNumber: result.collectorNumber, board: "main",
        legalityStatus: result.legalities?.[formatId],
      };
      const next = createDeckChangeProposal(deck, {
        additions: [{ card, quantity, reason: "Requested by you." }], removals: [], swaps: [],
        explanation: `Add ${quantity} ${result.name}.`,
      });
      setProposal(next);
      setMessage(next.legality.canApply
        ? "I prepared a reviewable change. The deck has not been modified."
        : "Trading Docks found a new legality violation. This proposal cannot be applied.");
    } catch {
      setMessage("Card search is unavailable right now. Nothing changed.");
    } finally { setBusy(false); }
  }

  function apply() {
    if (!proposal) return;
    try {
      onApply(applyDeckChangeProposal(deck, proposal));
      setMessage("Changes applied through the deterministic deck validation pipeline.");
      setProposal(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trading Docks rejected this change.");
    }
  }

  return (
    <aside aria-label="Deckmaster AI Deck Assistant" className={[
      "border-white/[0.08] bg-[#06131f] shadow-[0_24px_80px_rgba(0,0,0,.3)]",
      "fixed inset-0 z-[150] overflow-y-auto p-5 lg:sticky lg:top-5 lg:z-auto lg:block lg:max-h-[calc(100vh-2.5rem)] lg:rounded-[24px] lg:border lg:p-5",
      mobileOpen ? "block" : "hidden",
    ].join(" ")}>
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div><div className="flex items-center gap-2 text-cyan-300"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.18em]">AI Deck Assistant</span></div><h2 className="mt-1 text-xl font-semibold text-white">Deckmaster</h2><p className="mt-1 text-xs text-slate-500">Working on {context.deckName} · {context.format}</p></div>
        <button type="button" onClick={onMobileClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400 lg:hidden" aria-label="Close Deckmaster"><X className="h-4 w-4" /></button>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300" role="status">{message}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => <button key={action} type="button" onClick={() => void submit(action)} className="min-h-11 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-left text-xs font-medium text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.05] hover:text-white">{action}</button>)}
      </div>

      {proposal ? <ProposalReview proposal={proposal} onApply={apply} onCancel={() => { setProposal(null); setMessage("Proposal cancelled. Your deck is unchanged."); }} /> : null}

      <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-5 border-t border-white/[0.07] pt-4">
        <label htmlFor="deckmaster-input" className="sr-only">Ask Deckmaster about this deck</label>
        <textarea id="deckmaster-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Deckmaster about this deck..." rows={3} className="w-full resize-none rounded-xl border border-white/[0.09] bg-black/20 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" />
        <button disabled={busy || !input.trim()} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-semibold text-[#00121c] disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Ask Deckmaster</button>
      </form>
    </aside>
  );
}

function ProposalReview({ proposal, onApply, onCancel }: { proposal: DeckChangeProposal; onApply: () => void; onCancel: () => void }) {
  const count = proposal.additions.length + proposal.removals.length + proposal.swaps.length;
  return <section className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4">
    <p className="text-sm font-semibold text-white">Deckmaster recommends {count} {count === 1 ? "change" : "changes"}</p>
    <details open className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-cyan-200">Review Changes</summary>
      {proposal.additions.length ? <ChangeList label="Add" changes={proposal.additions} tone="text-emerald-300" /> : null}
      {proposal.removals.length ? <ChangeList label="Remove" changes={proposal.removals} tone="text-rose-300" /> : null}
      {proposal.swaps.map((swap) => <p key={`${swap.remove.card.id}-${swap.add.card.id}`} className="mt-3 text-xs text-slate-300">Swap {swap.remove.card.name} → {swap.add.card.name}</p>)}
    </details>
    <dl className="mt-4 space-y-2 border-t border-white/[0.07] pt-3 text-xs"><Row label="Estimated price change" value={`${proposal.pricingImpact >= 0 ? "+" : "−"}$${Math.abs(proposal.pricingImpact).toFixed(2)}`} /><Row label="Owned / missing change" value={`${signed(proposal.ownershipImpact.owned)} owned · ${signed(proposal.ownershipImpact.missing)} missing`} /></dl>
    <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs ${proposal.legality.canApply ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-100"}`}><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>{proposal.legality.valid ? "Legal complete-deck state" : proposal.legality.canApply ? "Safe for this in-progress deck; complete-format validation is still pending." : proposal.legality.introducedIssues.map((issue) => issue.message).join(" ")}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="h-10 rounded-xl border border-white/[0.09] text-xs font-semibold text-slate-300">Cancel</button><button type="button" onClick={onApply} disabled={!proposal.legality.canApply} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-semibold text-[#00121c] disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Apply All</button></div>
  </section>;
}

function ChangeList({ label, changes, tone }: { label: string; changes: Array<{ card: DeckCard; quantity: number }>; tone: string }) { return <div className="mt-3"><p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>{label}</p>{changes.map((change) => <div key={`${label}-${change.card.id}`} className="mt-2 flex items-center gap-3"><div className="h-12 w-9 overflow-hidden rounded-md bg-white/5">{change.card.image ? <img src={change.card.image} alt="" className="h-full w-full object-cover" /> : null}</div><span className="text-xs text-slate-200">{change.quantity}× {change.card.name}</span></div>)}</div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right text-slate-200">{value}</dd></div>; }
function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function categoryFor(typeLine: string) { return ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"].find((type) => typeLine.includes(type)) ?? "Other"; }
