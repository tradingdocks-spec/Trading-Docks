"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Layers3,
  Lock,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import {
  BUILD_INTENTS,
  INITIAL_DECK_ARCHITECT_FORMATS,
  calculateBuildabilityScore,
  compareRequirementsToCollection,
  getFormatProfile,
  analyzeDeckHealth,
  type BuildIntentId,
  type CollectionGraphCard,
  type DeckArchitectRole,
  type DeckArchitectFormatId,
  type DeckRequirement,
} from "@/lib/deck-architect";
import type { DeckArchitectCollectionSnapshot } from "@/lib/deck-architect/server";

const WORKFLOWS = [
  {
    name: "Build From My Collection",
    description: "Start with owned cards and let Deck Architect identify coherent shells, roles, and gaps.",
    status: "Foundation",
  },
  {
    name: "Build Around a Card",
    description: "Choose an owned or catalog card, then evaluate legal formats and archetype directions.",
    status: "Foundation",
  },
  {
    name: "Commander Build",
    description: "Rank eligible owned commanders by collection support, color identity, and missing-card cost.",
    status: "Live collection scan",
  },
  {
    name: "What Can I Build?",
    description: "Discover ready, nearly complete, and worth-considering builds from collection templates.",
    status: "Provider-ready",
  },
  {
    name: "Upgrade a Deck",
    description: "Review saved Deck Vault lists and generate structured change proposals before applying.",
    status: "Architecture",
  },
  {
    name: "Start From Scratch",
    description: "Use a traditional builder with collection intelligence, health, and missing-card diagnostics.",
    status: "Architecture",
  },
] as const;

const ENGINE_LAYERS = [
  ["Format rules", "Deck size, copy limits, sideboard, commander and color identity rules."],
  ["Collection Graph", "Owned quantities, printings, locations, wishlist, saved decks, and missing cards."],
  ["Deck Health", "Mana, consistency, interaction, card advantage, synergy, and legality signals."],
  ["Propose -> Review -> Apply", "Recommendations become structured proposals before any deck mutation."],
] as const;

export function DeckArchitectWorkspace({
  snapshot,
}: {
  snapshot: DeckArchitectCollectionSnapshot;
}) {
  const [formatId, setFormatId] = useState<DeckArchitectFormatId>("commander");
  const [intentId, setIntentId] = useState<BuildIntentId>("use-collection");
  const [commanderSearch, setCommanderSearch] = useState("");
  const format = getFormatProfile(formatId);
  const intent = BUILD_INTENTS[intentId];
  const filteredCommanders = useMemo(() => {
    const query = commanderSearch.trim().toLowerCase();
    return snapshot.commanderCandidates
      .filter((card) => !query || card.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [commanderSearch, snapshot.commanderCandidates]);
  const foundationRequirements = useMemo(
    () => buildFoundationRequirements(snapshot.cards, formatId),
    [formatId, snapshot.cards],
  );
  const ownership = useMemo(
    () => compareRequirementsToCollection(foundationRequirements, snapshot.cards, format),
    [format, foundationRequirements, snapshot.cards],
  );
  const buildability = useMemo(() => calculateBuildabilityScore(ownership), [ownership]);
  const health = useMemo(() => analyzeDeckHealth(foundationRequirements, format), [format, foundationRequirements]);
  const missing = ownership.filter((match) => match.missingQuantity > 0);

  return (
    <main className="min-h-screen bg-[#020912] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        {snapshot.error ? (
          <div className="mb-5 rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-100">
            Deck Architect could not load the collection snapshot: {snapshot.error}
          </div>
        ) : null}

        <header className="border-y border-white/[0.08] py-7">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Trading Docks Deck Intelligence
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-5xl">
                Deck Architect
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
                Build smarter decks from the cards you already own. Deck Architect
                starts with collection authority, applies format rules, scores
                buildability, then turns recommendations into reviewable proposals.
              </p>
            </div>

            <div className="grid gap-3 border-l border-white/[0.08] pl-5 sm:grid-cols-3 xl:grid-cols-1">
              <Metric label="Owned sample" value={snapshot.totalOwnedQuantity.toLocaleString("en-US")} detail="Quantity scanned for v1" />
              <Metric label="Unique records" value={snapshot.totalRows.toLocaleString("en-US")} detail={snapshot.truncated ? `Showing newest ${snapshot.sampleLimit}` : "Full snapshot loaded"} />
              <Metric label="Commanders" value={snapshot.commanderCandidates.length.toLocaleString("en-US")} detail="Eligible owned legends found" />
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="min-w-0 rounded-[22px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
            <SectionHeading
              eyebrow="Start workflow"
              title="Choose how Deck Architect should enter the collection graph."
            />
            <div className="mt-5 divide-y divide-white/[0.06] border-y border-white/[0.08]" role="list">
              {WORKFLOWS.map((workflow) => (
                <div
                  key={workflow.name}
                  className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
                  role="listitem"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{workflow.name}</p>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{workflow.description}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{workflow.status}</span>
                  <ArrowRight className="h-4 w-4 text-cyan-300/55" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
            <SectionHeading eyebrow="Format and intent" title="Rules first, then optimization." />
            <div className="mt-5 grid gap-3">
              <label className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Format</span>
                <select
                  value={formatId}
                  onChange={(event) => setFormatId(event.target.value as DeckArchitectFormatId)}
                  className="h-11 w-full rounded-[12px] border border-white/[0.08] bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  {INITIAL_DECK_ARCHITECT_FORMATS.map((id) => (
                    <option key={id} value={id}>{getFormatProfile(id).name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Build intent</span>
                <select
                  value={intentId}
                  onChange={(event) => setIntentId(event.target.value as BuildIntentId)}
                  className="h-11 w-full rounded-[12px] border border-white/[0.08] bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  {Object.values(BUILD_INTENTS).map((buildIntent) => (
                    <option key={buildIntent.id} value={buildIntent.id}>{buildIntent.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 border-y border-white/[0.08] py-4">
              <p className="text-sm font-semibold text-white">{format.name}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Rule label="Deck size" value={format.exactDeckSize ? `${format.exactDeckSize} exact` : `${format.minimumMainDeckSize ?? "Custom"}+`} />
                <Rule label="Copies" value={format.maximumCopies ? `${format.maximumCopies} max` : "Custom"} />
                <Rule label="Commander" value={format.commanderRequired ? "Required" : "Not required"} />
                <Rule label="Sideboard" value={format.sideboardAllowed ? `${format.maximumSideboardSize ?? "Custom"} max` : "No"} />
              </dl>
            </div>

            <div className="mt-4 rounded-[16px] border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">{intent.label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Ownership {percent(intent.ownershipWeight)} / Price {percent(intent.priceWeight)} / Power {percent(intent.powerWeight)} / Synergy {percent(intent.synergyWeight)}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(360px,0.7fr)]">
          <Panel title="Commanders in your collection" icon={<ShieldCheck className="h-4 w-4" />}>
            <label className="mt-4 flex h-11 items-center gap-2 rounded-[12px] border border-white/[0.08] bg-black/20 px-3">
              <Search className="h-4 w-4 text-slate-600" />
              <input
                value={commanderSearch}
                onChange={(event) => setCommanderSearch(event.target.value)}
                placeholder="Search owned commanders"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-700"
              />
            </label>
            <div className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.08]">
              {filteredCommanders.length ? filteredCommanders.map((card) => (
                <div key={card.inventoryId} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{card.name}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Owned: {card.quantityOwned} / {card.setCode ? card.setCode.toUpperCase() : "Set unknown"} {card.collectorNumber ? `#${card.collectorNumber}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-cyan-200">
                      {commanderBuildability(card, snapshot.cards)}%
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-cyan-300">
                    Commander workflow candidate
                  </p>
                </div>
              )) : (
                <EmptyState title="No owned commanders found in this snapshot" body="Deck Architect did not find legendary creature records with type-line metadata. Add or enrich collection records to unlock commander ranking." />
              )}
            </div>
          </Panel>

          <Panel title="Buildability foundation" icon={<Layers3 className="h-4 w-4" />}>
            <div className="mt-4 border-y border-white/[0.08] py-5">
              <p className="text-5xl font-semibold tracking-[-0.06em] text-white">{buildability.score}%</p>
              <p className="mt-2 text-sm text-slate-500">
                {buildability.ownedCards} / {buildability.requiredCards} required cards covered
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {foundationRequirements.length ? "Calculated from the current collection-derived foundation pool." : "Add collection records to calculate buildability."}
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {buildability.factors.map((factor) => (
                <div key={factor.label} className="rounded-[14px] bg-black/20 p-3">
                  <p className="text-xs text-slate-600">{factor.label}</p>
                  <p className={["mt-1 text-sm font-semibold", factor.impact === "negative" ? "text-amber-200" : "text-slate-200"].join(" ")}>
                    {factor.value}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Deck Health" icon={<BrainCircuit className="h-4 w-4" />}>
            <div className="mt-4 border-y border-white/[0.08] py-4">
              <p className="text-4xl font-semibold tracking-[-0.055em]">{health.overall}</p>
              <p className="mt-1 text-xs text-slate-600">Deterministic analyzer foundation</p>
            </div>
            <div className="mt-4 space-y-3">
              {Object.entries(health.categories).filter(([key]) => key !== "overall").map(([label, value]) => (
                <HealthRow key={label} label={label} value={value} />
              ))}
            </div>
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[22px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
            <SectionHeading eyebrow="Missing from this deck" title="Missing cards are a first-class object, not a footnote." />
            <div className="mt-5 divide-y divide-white/[0.06] border-y border-white/[0.08]">
              {missing.length ? missing.slice(0, 6).map((match) => (
                <div key={match.requirement.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-white">{match.requirement.name}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Needed {match.requirement.requiredQuantity} / Owned {match.ownedQuantity} / Missing {match.missingQuantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-300">
                    {match.estimatedMissingValue === null ? "Price unavailable" : `$${match.estimatedMissingValue.toFixed(2)}`}
                  </p>
                  <p className="text-left text-xs font-semibold text-cyan-300 sm:text-right">
                    Wishlist action pending
                  </p>
                </div>
              )) : (
                <EmptyState title="No missing cards in this foundation view" body={snapshot.cards.length ? "The current collection-derived requirement pool is covered." : "Missing cards will appear after the user has collection and candidate-deck data."} />
              )}
            </div>
          </div>

          <div className="rounded-[22px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
            <SectionHeading eyebrow="Proposal control" title="Propose, review, apply." />
            <div className="mt-5 space-y-4">
              <ProposalStep icon={<SlidersHorizontal className="h-4 w-4" />} title="Request" body="Natural-language requests become structured intent, not direct deck mutations." />
              <ProposalStep icon={<Lock className="h-4 w-4" />} title="Respect locks" body="Must Include and Locked cards are represented in deck state and protected during optimization." />
              <ProposalStep icon={<CheckCircle2 className="h-4 w-4" />} title="Apply after review" body="Future changes list remove/add lines, health delta, and additional purchase cost before applying." />
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[22px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
          <SectionHeading eyebrow="Engine architecture" title="Provider-ready foundations without fake production recommendations." />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ENGINE_LAYERS.map(([title, body]) => (
              <div key={title} className="border-l border-cyan-300/25 pl-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/deck-vault" className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-cyan-300 px-4 text-sm font-semibold text-[#01131a] transition hover:bg-cyan-200">
              Open Deck Vault
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard/inventory" className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-white/[0.1] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35">
              Add cards to Collection
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function buildFoundationRequirements(
  cards: CollectionGraphCard[],
  formatId: DeckArchitectFormatId,
): DeckRequirement[] {
  const format = getFormatProfile(formatId);
  const commander = format.commanderRequired ? cards.find((card) => /legendary/i.test(card.typeLine ?? "")) : null;
  const ownedCards = cards.slice(0, format.commanderRequired ? 29 : 36);
  const requirements: DeckRequirement[] = [];
  if (commander) {
    requirements.push({
      id: `commander:${commander.inventoryId}`,
      name: commander.name,
      requiredQuantity: 1,
      board: "commander",
      roles: ["synergy"],
      estimatedPrice: commander.marketPrice,
      importance: 1.5,
      typeLine: commander.typeLine,
      isCommander: true,
      legalityStatus: "unknown",
    });
  }
  for (const card of ownedCards) {
    requirements.push({
      id: `main:${card.inventoryId}`,
      name: card.name,
      requiredQuantity: format.singleton ? 1 : Math.min(4, Math.max(1, Math.min(card.quantityOwned, 4))),
      board: "main",
      roles: inferRoles(card),
      estimatedPrice: card.marketPrice,
      typeLine: card.typeLine,
      colorIdentity: card.colorIdentity,
      legalityStatus: "unknown",
    });
  }
  return requirements;
}

function inferRoles(card: CollectionGraphCard): DeckArchitectRole[] {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const name = card.name.toLowerCase();
  const roles: DeckArchitectRole[] = [];
  if (typeLine.includes("land")) roles.push("land");
  if (/draw|study|ponder|consider|insight|harmonize/.test(name)) roles.push("card-advantage");
  if (/counter|negate|swords|path|destroy|exile|bolt|removal/.test(name)) roles.push("interaction", "removal");
  if (/ramp|signet|sol ring|cultivate|treasure/.test(name)) roles.push("ramp", "mana-fixing");
  if (/tutor|search/.test(name)) roles.push("tutor");
  if (/combo|engine|altar|station/.test(name)) roles.push("combo-piece", "synergy");
  if (!roles.length) roles.push(typeLine.includes("creature") ? "threat" : "synergy");
  return [...new Set(roles)];
}

function commanderBuildability(card: CollectionGraphCard, collection: CollectionGraphCard[]) {
  const support = collection.filter((item) => {
    const colors = item.colorIdentity ?? [];
    const commanderColors = card.colorIdentity ?? [];
    return colors.every((color) => commanderColors.includes(color));
  }).length;
  return Math.min(99, Math.max(35, 60 + support * 2));
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h2>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-700">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-300">{value}</dd>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-[22px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.20)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-cyan-300">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-8">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs capitalize text-slate-500">{label.replace("-", " ")}</p>
        <p className="text-sm font-semibold text-slate-200">{value}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
        <span className="block h-full rounded-full bg-cyan-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ProposalStep({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-cyan-300/15 bg-cyan-300/[0.055] text-cyan-300">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
      </div>
    </div>
  );
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
