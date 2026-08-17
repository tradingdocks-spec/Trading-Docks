"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Layers3,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import {
  BUILD_INTENTS,
  INITIAL_DECK_ARCHITECT_FORMATS,
  analyzeDeckHealth,
  buildWorkingDeckRequirementsFromCollection,
  calculateBuildabilityScore,
  compareRequirementsToCollection,
  getFormatProfile,
  proposeDeckRecommendations,
  type BuildOpportunity,
  type BuildIntentId,
  type CollectionGraphCard,
  type DeckArchitectFormatId,
  type DeckArchitectIntelligence,
  type DeckArchitectRole,
  type DeckArchitectSavedDeckSummary,
  type DeckRecommendation,
  type DeckRequirement,
  type OwnershipMatch,
} from "@/lib/deck-architect";
import type { DeckArchitectCollectionSnapshot } from "@/lib/deck-architect/server";

type WorkflowId = "build-deck" | "collection" | "improve" | "discover";
type ViewMode = "deck" | "cards" | "intelligence";

const PRIMARY_WORKFLOWS: Array<{
  id: WorkflowId;
  title: string;
  description: string;
  action: string;
}> = [
  {
    id: "build-deck",
    title: "Build a Deck",
    description: "Start with a format, commander, card, or strategy.",
    action: "Start building",
  },
  {
    id: "collection",
    title: "Build From My Collection",
    description: "Prioritize cards already tracked in your inventory.",
    action: "Use my cards",
  },
  {
    id: "improve",
    title: "Improve a Deck",
    description: "Choose a saved Deck Vault deck and review changes before applying.",
    action: "Open Deck Vault",
  },
  {
    id: "discover",
    title: "What Can I Build?",
    description: "Find deck opportunities your collection is already close to supporting.",
    action: "Check opportunities",
  },
];

const INTENT_COPY: Record<BuildIntentId, { label: string; body: string }> = {
  "use-collection": {
    label: "Use My Collection",
    body: "Prioritize cards I already own.",
  },
  "no-purchases": {
    label: "No Purchases",
    body: "Only use cards currently in my collection.",
  },
  "strongest-possible": {
    label: "Best Possible",
    body: "Recommend the strongest appropriate build, even if I need cards.",
  },
  budget: {
    label: "Budget Build",
    body: "Improve the deck while keeping missing-card cost under control.",
  },
  casual: {
    label: "Casual",
    body: "Favor a fun, cohesive deck over maximum optimization.",
  },
  competitive: {
    label: "Competitive",
    body: "Favor consistency, efficiency, and stronger archetype alignment.",
  },
  "upgrade-over-time": {
    label: "Upgrade Over Time",
    body: "Plan improvements in small, reviewable steps.",
  },
};

const ROLE_ORDER: DeckArchitectRole[] = [
  "ramp",
  "card-advantage",
  "interaction",
  "protection",
  "synergy",
  "threat",
  "finisher",
  "land",
];

export function DeckArchitectWorkspace({
  intelligence,
  savedDecks,
  snapshot,
}: {
  intelligence: DeckArchitectIntelligence;
  savedDecks: DeckArchitectSavedDeckSummary[];
  snapshot: DeckArchitectCollectionSnapshot;
}) {
  const [workflowId, setWorkflowId] = useState<WorkflowId | null>(null);
  const [formatId, setFormatId] = useState<DeckArchitectFormatId>("commander");
  const [intentId, setIntentId] = useState<BuildIntentId>("use-collection");
  const [commanderSearch, setCommanderSearch] = useState("");
  const [selectedCommanderId, setSelectedCommanderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("deck");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [lockedCards, setLockedCards] = useState<Set<string>>(() => new Set());
  const [mustIncludeCards, setMustIncludeCards] = useState<Set<string>>(() => new Set());

  const format = getFormatProfile(formatId);
  const intent = BUILD_INTENTS[intentId];
  const selectedCommander = snapshot.commanderCandidates.find((card) => card.inventoryId === selectedCommanderId) ?? null;
  const canBuildWorkingDeck = snapshot.cards.length > 0 && (!format.commanderRequired || Boolean(selectedCommander));

  const deckRequirements = useMemo(
    () => canBuildWorkingDeck ? buildWorkingDeckRequirementsFromCollection(snapshot.cards, formatId, selectedCommander, intentId) : [],
    [canBuildWorkingDeck, formatId, intentId, selectedCommander, snapshot.cards],
  );
  const targetDeckSize = format.exactDeckSize ?? format.minimumMainDeckSize ?? 60;
  const hasCompleteWorkingDeck = deckRequirements.reduce((sum, card) => sum + card.requiredQuantity, 0) >= targetDeckSize;
  const ownership = useMemo(
    () => deckRequirements.length ? compareRequirementsToCollection(deckRequirements, snapshot.cards, format) : [],
    [deckRequirements, format, snapshot.cards],
  );
  const buildability = useMemo(
    () => ownership.length && hasCompleteWorkingDeck ? calculateBuildabilityScore(ownership) : null,
    [hasCompleteWorkingDeck, ownership],
  );
  const health = useMemo(
    () => deckRequirements.length && hasCompleteWorkingDeck ? analyzeDeckHealth(deckRequirements, format) : null,
    [deckRequirements, format, hasCompleteWorkingDeck],
  );
  const activeRecommendations = useMemo(
    () => deckRequirements.length && hasCompleteWorkingDeck
      ? proposeDeckRecommendations({
        requirements: deckRequirements,
        collection: snapshot.cards,
        format,
        commander: selectedCommander,
        lockedCardIds: lockedCards,
        mustIncludeCardIds: mustIncludeCards,
      })
      : intelligence.recommendations,
    [deckRequirements, format, hasCompleteWorkingDeck, intelligence.recommendations, lockedCards, mustIncludeCards, selectedCommander, snapshot.cards],
  );
  const selectedCard = ownership.find((match) => match.requirement.id === selectedCardId) ?? null;
  const missing = ownership.filter((match) => match.missingQuantity > 0);
  const totalKnownMissingCost = missing.every((match) => match.estimatedMissingValue !== null)
    ? missing.reduce((sum, match) => sum + (match.estimatedMissingValue ?? 0), 0)
    : null;
  const grouped = groupByRole(ownership);
  const filteredCommanders = useMemo(() => {
    const query = commanderSearch.trim().toLowerCase();
    return snapshot.commanderCandidates
      .filter((card) => !query || card.name.toLowerCase().includes(query))
      .slice(0, 12);
  }, [commanderSearch, snapshot.commanderCandidates]);

  function toggleSet(setter: (value: Set<string>) => void, source: Set<string>, id: string) {
    const next = new Set(source);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  return (
    <main className="min-h-screen bg-[#020912] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1520px]">
        {snapshot.error ? <LoadError message={snapshot.error} /> : null}

        <header className="border-y border-white/[0.08] py-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div>
              <p className="text-sm font-semibold text-cyan-300">Trading Docks</p>
              <h1 className="mt-2 text-4xl font-semibold leading-none tracking-[-0.055em] sm:text-5xl">
                Deck Architect
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                Build, improve, and discover decks using the cards you actually own.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Choose a format, build around your collection, or find decks you are already close to completing.
              </p>
            </div>
            <CollectionSummary snapshot={snapshot} />
          </div>
        </header>

        {!workflowId ? (
          <section className="mt-6 grid gap-4 lg:grid-cols-4">
            {PRIMARY_WORKFLOWS.map((workflow) => {
              const className = "group min-h-[210px] rounded-[18px] bg-[#06131f] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_18px_54px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:bg-[#071827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45";
              const content = (
                <div className="flex h-full flex-col">
                  <p className="text-lg font-semibold tracking-[-0.025em] text-white">{workflow.title}</p>
                  {workflow.id === "collection" ? (
                    <p className="mt-3 text-sm font-semibold text-cyan-200">
                      {snapshot.totalOwnedQuantity.toLocaleString("en-US")} cards currently tracked
                    </p>
                  ) : null}
                  {workflow.id === "improve" ? (
                    <p className="mt-3 text-sm font-semibold text-cyan-200">
                      {savedDecks.length ? `${savedDecks.length} recent Deck Vault decks available` : "Open Deck Vault to import or save a deck"}
                    </p>
                  ) : null}
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">{workflow.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">
                    {workflow.action}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              );
              return workflow.id === "improve" ? (
                <Link key={workflow.id} href="/dashboard/deck-vault" className={className}>
                  {content}
                </Link>
              ) : (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => {
                    setWorkflowId(workflow.id);
                    setViewMode("deck");
                  }}
                  className={className}
                >
                  {content}
                </button>
              );
            })}
          </section>
        ) : (
          <section className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <SetupPanel
                workflowId={workflowId}
                setWorkflowId={setWorkflowId}
                formatId={formatId}
                setFormatId={(value) => {
                  setFormatId(value);
                  setSelectedCommanderId(null);
                  setSelectedCardId(null);
                }}
                intentId={intentId}
                setIntentId={setIntentId}
              />
              {format.commanderRequired ? (
                <CommanderPicker
                  commanders={filteredCommanders}
                  selectedCommanderId={selectedCommanderId}
                  setSelectedCommanderId={(id) => {
                    setSelectedCommanderId(id);
                    setWorkflowId(workflowId ?? "build-deck");
                    setViewMode("deck");
                  }}
                  search={commanderSearch}
                  setSearch={setCommanderSearch}
                  strategiesByCommander={intelligence.commanderStrategies}
                />
              ) : null}
            </aside>

            <div className="min-w-0">
              {workflowId === "discover" ? (
                <DiscoverWorkspace
                  opportunities={intelligence.opportunities}
                  provider={intelligence.provider}
                  limitations={intelligence.limitations}
                  onChooseFormat={(nextFormat) => {
                    setFormatId(nextFormat);
                    setWorkflowId("build-deck");
                    setViewMode("deck");
                  }}
                />
              ) : !canBuildWorkingDeck ? (
                <PreBuildState
                  formatId={formatId}
                  formatRequiresCommander={format.commanderRequired}
                  hasCollection={snapshot.cards.length > 0}
                  hasCommanders={snapshot.commanderCandidates.length > 0}
                  setFormatId={setFormatId}
                />
              ) : (
                <ActiveDeckWorkspace
                  buildability={buildability}
                  formatId={formatId}
                  formatName={format.name}
                  grouped={grouped}
                  health={health}
                  isCompleteWorkingDeck={hasCompleteWorkingDeck}
                  intentLabel={INTENT_COPY[intent.id].label}
                  lockedCards={lockedCards}
                  missing={missing}
                  mustIncludeCards={mustIncludeCards}
                  ownership={ownership}
                  selectedCard={selectedCard}
                  selectedCommander={selectedCommander}
                  recommendations={activeRecommendations}
                  setSelectedCardId={setSelectedCardId}
                  toggleLocked={(id) => toggleSet(setLockedCards, lockedCards, id)}
                  toggleMustInclude={(id) => toggleSet(setMustIncludeCards, mustIncludeCards, id)}
                  totalKnownMissingCost={totalKnownMissingCost}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                />
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function CollectionSummary({ snapshot }: { snapshot: DeckArchitectCollectionSnapshot }) {
  return (
    <section className="rounded-[18px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Your Collection</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Deck Architect uses cards saved to your Trading Docks collection.
          </p>
        </div>
        <Link href="/dashboard/inventory" className="text-xs font-semibold text-cyan-300 hover:text-cyan-100">
          View collection
        </Link>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <SummaryMetric label="Cards tracked" value={snapshot.totalOwnedQuantity.toLocaleString("en-US")} />
        <SummaryMetric label="Unique cards" value={snapshot.totalRows.toLocaleString("en-US")} />
        <SummaryMetric label="Commanders" value={snapshot.commanderCandidates.length.toLocaleString("en-US")} />
      </dl>
      {!snapshot.commanderCandidates.length ? (
        <div className="mt-4 rounded-[14px] bg-black/20 p-3">
          <p className="text-xs font-semibold text-slate-200">No commanders found yet</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Add legendary creatures to your collection or choose another format to continue.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function DiscoverWorkspace({
  opportunities,
  provider,
  limitations,
  onChooseFormat,
}: {
  opportunities: BuildOpportunity[];
  provider: DeckArchitectIntelligence["provider"];
  limitations: string[];
  onChooseFormat: (formatId: DeckArchitectFormatId) => void;
}) {
  const ready = opportunities.filter((opportunity) => opportunity.category === "ready-now");
  const nearly = opportunities.filter((opportunity) => opportunity.category === "nearly-complete");
  const considering = opportunities.filter((opportunity) => opportunity.category === "worth-considering");

  return (
    <section className="space-y-5">
      <div className="rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.2)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-300">What Can I Build?</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-white">Collection opportunities</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Ranked from deterministic archetype profiles, owned quantities, missing-card cost, and legality validation.
            </p>
          </div>
          <div className="rounded-[14px] bg-black/20 px-4 py-3">
            <p className="text-xs font-semibold text-slate-200">{provider.name}</p>
            <p className="mt-1 text-xs text-slate-500">Trading Docks-authored rules</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <HeaderMetric label="Ready now" value={String(ready.length)} />
          <HeaderMetric label="Nearly complete" value={String(nearly.length)} />
          <HeaderMetric label="Worth considering" value={String(considering.length)} />
        </div>
      </div>

      {opportunities.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} onChooseFormat={onChooseFormat} />
          ))}
        </div>
      ) : (
        <CenteredState
          title="No supported opportunities yet"
          body="Deck Architect did not find a supported Pauper or Commander opportunity in the current collection snapshot."
          action={<LinkButton href="/dashboard/inventory">Add cards</LinkButton>}
        />
      )}

      <div className="rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
        <p className="text-sm font-semibold text-white">Provider boundaries</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {limitations.map((item) => (
            <p key={item} className="rounded-[12px] bg-black/20 p-3 text-xs leading-5 text-slate-500">
              {item}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function OpportunityCard({
  opportunity,
  onChooseFormat,
}: {
  opportunity: BuildOpportunity;
  onChooseFormat: (formatId: DeckArchitectFormatId) => void;
}) {
  const category = opportunity.category === "ready-now"
    ? "Ready now"
    : opportunity.category === "nearly-complete"
      ? "Nearly complete"
      : "Worth considering";
  const categoryClass = opportunity.category === "ready-now"
    ? "text-emerald-200"
    : opportunity.category === "nearly-complete"
      ? "text-cyan-200"
      : "text-slate-300";
  const missing = opportunity.missingCards ?? [];
  const substitutions = opportunity.ownedSubstitutions ?? [];

  return (
    <article className="rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${categoryClass}`}>{category}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-white">{opportunity.name}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{opportunity.disclosure}</p>
        </div>
        <p className="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold text-slate-300">
          {getFormatProfile(opportunity.formatId).name}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <HeaderMetric label="Buildable" value={`${opportunity.buildability.score}%`} />
        <HeaderMetric label="Owned" value={`${opportunity.buildability.ownedCards}/${opportunity.buildability.requiredCards}`} />
        <HeaderMetric
          label="Completion"
          value={opportunity.buildability.estimatedCompletionCost === null ? "Unknown" : `$${opportunity.buildability.estimatedCompletionCost.toFixed(0)}`}
        />
      </div>
      <div className="mt-5 space-y-2">
        {missing.slice(0, 3).map((match) => (
          <div key={match.requirement.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-black/20 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{match.requirement.name}</p>
              <p className="mt-1 text-xs text-slate-500">Need {match.missingQuantity} / {primaryRoleLabel(match.requirement.roles)}</p>
            </div>
            <p className="text-xs font-semibold text-slate-300">
              {match.estimatedMissingValue === null ? "Price unavailable" : `$${match.estimatedMissingValue.toFixed(2)}`}
            </p>
          </div>
        ))}
        {substitutions[0] ? (
          <p className="rounded-[12px] bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100/80">
            Owned substitute: {substitutions[0].ownedCard.name} for {substitutions[0].missingCardName}
          </p>
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onChooseFormat(opportunity.formatId)}
          className="rounded-[12px] bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#02131b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45"
        >
          Build in this format
        </button>
        <p className="text-xs text-slate-500">
          Confidence: {opportunity.confidence ?? "medium"}
        </p>
      </div>
    </article>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-[-0.04em] text-white">{value}</dd>
    </div>
  );
}

function SetupPanel({
  workflowId,
  setWorkflowId,
  formatId,
  setFormatId,
  intentId,
  setIntentId,
}: {
  workflowId: WorkflowId;
  setWorkflowId: (value: WorkflowId | null) => void;
  formatId: DeckArchitectFormatId;
  setFormatId: (value: DeckArchitectFormatId) => void;
  intentId: BuildIntentId;
  setIntentId: (value: BuildIntentId) => void;
}) {
  const selectedWorkflow = PRIMARY_WORKFLOWS.find((workflow) => workflow.id === workflowId);

  return (
    <section className="rounded-[18px] bg-[#06131f] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
      <button
        type="button"
        onClick={() => setWorkflowId(null)}
        className="mb-4 text-xs font-semibold text-slate-500 transition hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45"
      >
        Change workflow
      </button>
      <p className="text-lg font-semibold tracking-[-0.025em] text-white">{selectedWorkflow?.title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{selectedWorkflow?.description}</p>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-200">Choose format</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {INITIAL_DECK_ARCHITECT_FORMATS.filter((id) => id !== "custom" && id !== "brawl").map((id) => {
            const profile = getFormatProfile(id);
            const selected = id === formatId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFormatId(id)}
                className={[
                  "rounded-[12px] px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45",
                  selected ? "bg-cyan-300 text-[#02131b]" : "bg-black/20 text-slate-300 hover:bg-white/[0.06]",
                ].join(" ")}
              >
                {profile.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-200">Build intent</p>
        <div className="mt-3 space-y-2">
          {Object.values(INTENT_COPY).map((copy) => {
            const id = Object.keys(INTENT_COPY).find((key) => INTENT_COPY[key as BuildIntentId] === copy) as BuildIntentId;
            const selected = id === intentId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setIntentId(id)}
                className={[
                  "w-full rounded-[12px] p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45",
                  selected ? "bg-white/[0.075]" : "bg-black/20 hover:bg-white/[0.045]",
                ].join(" ")}
              >
                <span className="block text-sm font-semibold text-white">{copy.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{copy.body}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CommanderPicker({
  commanders,
  selectedCommanderId,
  setSelectedCommanderId,
  search,
  setSearch,
  strategiesByCommander,
}: {
  commanders: CollectionGraphCard[];
  selectedCommanderId: string | null;
  setSelectedCommanderId: (id: string) => void;
  search: string;
  setSearch: (value: string) => void;
  strategiesByCommander: DeckArchitectIntelligence["commanderStrategies"];
}) {
  return (
    <section className="rounded-[18px] bg-[#06131f] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
      <p className="text-sm font-semibold text-white">Choose commander</p>
      <label className="mt-3 flex h-10 items-center gap-2 rounded-[12px] bg-black/25 px-3">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search owned commanders"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
        />
      </label>
      <div className="mt-3 space-y-2">
        {commanders.length ? commanders.map((card) => {
          const selected = card.inventoryId === selectedCommanderId;
          const strategy = strategiesByCommander[card.inventoryId]?.[0];
          return (
            <button
              key={card.inventoryId}
              type="button"
              onClick={() => setSelectedCommanderId(card.inventoryId)}
              className={[
                "flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45",
                selected ? "bg-cyan-300/10" : "bg-black/20 hover:bg-white/[0.045]",
              ].join(" ")}
            >
              <CardThumb card={card} size="small" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{card.name}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Owned {card.quantityOwned}{card.setCode ? ` / ${card.setCode.toUpperCase()}` : ""}
                </span>
                {strategy ? (
                  <span className="mt-1 block truncate text-xs text-cyan-200/80">
                    {strategy.label} / {strategy.confidence} confidence
                  </span>
                ) : null}
              </span>
              {selected ? <Check className="h-4 w-4 text-cyan-200" /> : <ChevronRight className="h-4 w-4 text-slate-600" />}
            </button>
          );
        }) : (
          <div className="rounded-[14px] bg-black/20 p-4">
            <p className="text-sm font-semibold text-slate-100">No commanders found yet</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Deck Architect could not find an eligible commander in your current collection.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/dashboard/inventory" className="rounded-[10px] bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#02131b]">
                Add cards
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PreBuildState({
  formatId,
  formatRequiresCommander,
  hasCollection,
  hasCommanders,
  setFormatId,
}: {
  formatId: DeckArchitectFormatId;
  formatRequiresCommander: boolean;
  hasCollection: boolean;
  hasCommanders: boolean;
  setFormatId: (value: DeckArchitectFormatId) => void;
}) {
  if (!hasCollection) {
    return (
      <CenteredState
        title="Add cards to start building"
        body="Deck Architect works from your Trading Docks collection. Add owned cards, then return here to build with them."
        action={<LinkButton href="/dashboard/inventory">Open Collection</LinkButton>}
      />
    );
  }

  if (formatRequiresCommander && !hasCommanders) {
    return (
      <CenteredState
        title="No commanders found yet"
        body="Choose a non-Commander format, or add eligible legendary creatures to your collection."
        action={
          <button
            type="button"
            onClick={() => setFormatId("casual60")}
            className="rounded-[12px] bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#02131b]"
          >
            Choose another format
          </button>
        }
      />
    );
  }

  return (
    <CenteredState
      title={formatId === "commander" ? "Choose a commander" : "Ready to build"}
      body={formatRequiresCommander ? "Select an owned commander to create a working deck plan." : "Deck Architect can now create a working deck plan from your collection."}
    />
  );
}

function ActiveDeckWorkspace({
  buildability,
  formatId,
  formatName,
  grouped,
  health,
  isCompleteWorkingDeck,
  intentLabel,
  lockedCards,
  missing,
  mustIncludeCards,
  ownership,
  recommendations,
  selectedCard,
  selectedCommander,
  setSelectedCardId,
  toggleLocked,
  toggleMustInclude,
  totalKnownMissingCost,
  viewMode,
  setViewMode,
}: {
  buildability: ReturnType<typeof calculateBuildabilityScore> | null;
  formatId: DeckArchitectFormatId;
  formatName: string;
  grouped: Array<[DeckArchitectRole, OwnershipMatch[]]>;
  health: ReturnType<typeof analyzeDeckHealth> | null;
  isCompleteWorkingDeck: boolean;
  intentLabel: string;
  lockedCards: Set<string>;
  missing: OwnershipMatch[];
  mustIncludeCards: Set<string>;
  ownership: OwnershipMatch[];
  recommendations: DeckRecommendation[];
  selectedCard: OwnershipMatch | null;
  selectedCommander: CollectionGraphCard | null;
  setSelectedCardId: (id: string | null) => void;
  toggleLocked: (id: string) => void;
  toggleMustInclude: (id: string) => void;
  totalKnownMissingCost: number | null;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
}) {
  const deckName = selectedCommander ? `${selectedCommander.name} Build` : `${formatName} Collection Build`;
  const owned = buildability?.ownedCards ?? 0;
  const required = buildability?.requiredCards ?? 0;
  const missingCount = buildability?.missingCards ?? 0;

  return (
    <section className="min-w-0">
      <div className="rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045),0_20px_70px_rgba(0,0,0,.2)]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 gap-4">
            {selectedCommander ? <CardThumb card={selectedCommander} size="large" /> : null}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cyan-300">{formatName} / {intentLabel}</p>
              <h2 className="mt-1 truncate text-3xl font-semibold tracking-[-0.05em] text-white">{deckName}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {isCompleteWorkingDeck
                  ? "Working deck plan based on cards saved in your collection. Review every change before saving to Deck Vault."
                  : "Working shell based on cards saved in your collection. Add more cards or choose another format for full deck scoring."}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
            <HeaderMetric label="Buildable" value={buildability ? `${buildability.score}%` : "Not calculated"} />
            <HeaderMetric label="Owned" value={required ? `${owned}/${required}` : "Not calculated"} />
            <HeaderMetric label="Health" value={health ? String(health.overall) : "Not calculated"} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {(["deck", "cards", "intelligence"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={[
                "h-9 rounded-full px-4 text-sm font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45",
                viewMode === mode ? "bg-cyan-300 text-[#02131b]" : "bg-black/25 text-slate-300 hover:bg-white/[0.06]",
              ].join(" ")}
            >
              {mode}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            Save to Deck Vault after proposal persistence is enabled.
          </span>
        </div>
      </div>

      {viewMode === "deck" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DeckStructure grouped={grouped} setSelectedCardId={setSelectedCardId} />
          <SideRail
            buildability={buildability}
            health={health}
            missing={missing}
            totalKnownMissingCost={totalKnownMissingCost}
          />
        </div>
      ) : null}

      {viewMode === "cards" ? (
        <CardWorkspace
          ownership={ownership}
          selectedCard={selectedCard}
          setSelectedCardId={setSelectedCardId}
          lockedCards={lockedCards}
          mustIncludeCards={mustIncludeCards}
          toggleLocked={toggleLocked}
          toggleMustInclude={toggleMustInclude}
        />
      ) : null}

      {viewMode === "intelligence" ? (
        <DeckIntelligence health={health} missing={missing} formatId={formatId} recommendations={recommendations} />
      ) : null}

      {selectedCard ? (
        <CardDetailDrawer
          match={selectedCard}
          locked={lockedCards.has(selectedCard.requirement.id)}
          mustInclude={mustIncludeCards.has(selectedCard.requirement.id)}
          onClose={() => setSelectedCardId(null)}
          toggleLocked={() => toggleLocked(selectedCard.requirement.id)}
          toggleMustInclude={() => toggleMustInclude(selectedCard.requirement.id)}
        />
      ) : null}
    </section>
  );
}

function DeckStructure({
  grouped,
  setSelectedCardId,
}: {
  grouped: Array<[DeckArchitectRole, OwnershipMatch[]]>;
  setSelectedCardId: (id: string) => void;
}) {
  return (
    <section className="rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold tracking-[-0.025em] text-white">Deck Structure</p>
          <p className="mt-1 text-sm text-slate-500">Cards are grouped by their primary role in the current plan.</p>
        </div>
      </div>
      <div className="mt-5 space-y-5">
        {grouped.map(([role, matches]) => (
          <div key={role}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold capitalize text-slate-200">{role.replace("-", " ")}</p>
              <p className="text-xs text-slate-600">{matches.length} cards</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {matches.slice(0, 10).map((match) => (
                <button
                  key={match.requirement.id}
                  type="button"
                  onClick={() => setSelectedCardId(match.requirement.id)}
                  className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45"
                >
                  <div className="overflow-hidden rounded-[14px] bg-black/25">
                    <CardImage card={match.requirement} />
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-white">{match.requirement.name}</p>
                  <OwnershipPill match={match} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SideRail({
  buildability,
  health,
  missing,
  totalKnownMissingCost,
}: {
  buildability: ReturnType<typeof calculateBuildabilityScore> | null;
  health: ReturnType<typeof analyzeDeckHealth> | null;
  missing: OwnershipMatch[];
  totalKnownMissingCost: number | null;
}) {
  return (
    <aside className="space-y-5">
      <InfoPanel title="Buildability" icon={<Layers3 className="h-4 w-4" />}>
        {buildability ? (
          <>
            <p className="text-4xl font-semibold tracking-[-0.055em] text-white">{buildability.score}%</p>
            <p className="mt-2 text-sm text-slate-500">
              {buildability.ownedCards} / {buildability.requiredCards} cards available
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {buildability.missingCards} missing
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-200">
              Estimated completion: {totalKnownMissingCost === null ? "Price unavailable" : `$${totalKnownMissingCost.toFixed(2)}`}
            </p>
          </>
        ) : (
          <p className="text-sm leading-6 text-slate-500">Choose or build a deck to see how much of it you already own.</p>
        )}
      </InfoPanel>

      <InfoPanel title="Deck Health" icon={<ShieldCheck className="h-4 w-4" />}>
        {health ? (
          <>
            <p className="text-4xl font-semibold tracking-[-0.055em] text-white">{health.overall}</p>
            <div className="mt-4 space-y-3">
              {Object.entries(health.categories).filter(([key]) => key !== "overall").map(([label, value]) => (
                <HealthRow key={label} label={label} value={value} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm leading-6 text-slate-500">Choose or build a deck to analyze its balance, consistency, and interaction.</p>
        )}
      </InfoPanel>

      <InfoPanel title="Missing Cards" icon={<BookOpen className="h-4 w-4" />}>
        {missing.length ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {missing.length} cards missing. Estimated completion: {totalKnownMissingCost === null ? "Price unavailable" : `$${totalKnownMissingCost.toFixed(2)}`}
            </p>
            {missing.slice(0, 4).map((match) => (
              <div key={match.requirement.id} className="rounded-[12px] bg-black/20 p-3">
                <p className="text-sm font-semibold text-white">{match.requirement.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Need {match.requirement.requiredQuantity} / Owned {match.ownedQuantity}
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {match.estimatedMissingValue === null ? "Price unavailable" : `$${match.estimatedMissingValue.toFixed(2)}`}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-500">You already own every card in this working plan.</p>
        )}
      </InfoPanel>
    </aside>
  );
}

function CardWorkspace({
  ownership,
  selectedCard,
  setSelectedCardId,
  lockedCards,
  mustIncludeCards,
  toggleLocked,
  toggleMustInclude,
}: {
  ownership: OwnershipMatch[];
  selectedCard: OwnershipMatch | null;
  setSelectedCardId: (id: string) => void;
  lockedCards: Set<string>;
  mustIncludeCards: Set<string>;
  toggleLocked: (id: string) => void;
  toggleMustInclude: (id: string) => void;
}) {
  return (
    <section className="mt-5 rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-lg font-semibold tracking-[-0.025em] text-white">Card Workspace</p>
          <p className="mt-1 text-sm text-slate-500">Review ownership, roles, prices, locks, and must-include choices.</p>
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-[16px] bg-black/20">
        {ownership.map((match) => {
          const selected = selectedCard?.requirement.id === match.requirement.id;
          return (
            <div
              key={match.requirement.id}
              className={[
                "grid gap-3 border-b border-white/[0.06] p-3 last:border-b-0 md:grid-cols-[52px_minmax(0,1fr)_120px_120px_120px] md:items-center",
                selected ? "bg-cyan-300/[0.055]" : "",
              ].join(" ")}
            >
              <button type="button" onClick={() => setSelectedCardId(match.requirement.id)} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45">
                <CardThumb card={match.requirement} size="small" />
              </button>
              <button type="button" onClick={() => setSelectedCardId(match.requirement.id)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45">
                <p className="truncate text-sm font-semibold text-white">{match.requirement.name}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{match.requirement.typeLine ?? "Card type unavailable"}</p>
              </button>
              <OwnershipPill match={match} />
              <p className="text-sm text-slate-300">{match.requirement.estimatedPrice == null ? "Price unavailable" : `$${match.requirement.estimatedPrice.toFixed(2)}`}</p>
              <div className="flex gap-2">
                <IconToggle
                  active={lockedCards.has(match.requirement.id)}
                  label="Lock card"
                  onClick={() => toggleLocked(match.requirement.id)}
                  icon={<Lock className="h-4 w-4" />}
                />
                <IconToggle
                  active={mustIncludeCards.has(match.requirement.id)}
                  label="Mark must include"
                  onClick={() => toggleMustInclude(match.requirement.id)}
                  icon={<Star className="h-4 w-4" />}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeckIntelligence({
  health,
  missing,
  formatId,
  recommendations,
}: {
  health: ReturnType<typeof analyzeDeckHealth> | null;
  missing: OwnershipMatch[];
  formatId: DeckArchitectFormatId;
  recommendations: DeckRecommendation[];
}) {
  const issues = health?.warnings ?? [];
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
        <p className="text-lg font-semibold tracking-[-0.025em] text-white">Deck Intelligence</p>
        <p className="mt-1 text-sm text-slate-500">Recommendations stay reviewable. Deck Architect never mutates a deck silently.</p>
        <div className="mt-5 space-y-3">
          {issues.length ? issues.map((issue) => (
            <IntelligenceItem
              key={issue}
              title={issue}
              body="Review cards in this role and compare owned alternatives before applying changes."
              tone="attention"
            />
          )) : (
            <IntelligenceItem
              title="No urgent health issues"
              body="This working plan has no major balance warnings from the current analyzer."
              tone="good"
            />
          )}
          {missing.length ? (
            <IntelligenceItem
              title="Missing opportunity"
              body={`${missing[0].requirement.name} is not currently owned. Look for an owned card with a similar role before adding it to a wishlist.`}
              tone="neutral"
            />
          ) : null}
          <IntelligenceItem
            title={formatId === "commander" ? "Commander plan ready for review" : "Deck plan ready for review"}
            body="Save/apply actions remain disabled until Deck Vault proposal persistence is connected."
            tone="neutral"
          />
          {recommendations.slice(0, 3).map((recommendation) => (
            <IntelligenceItem
              key={recommendation.id}
              title={recommendation.title}
              body={`${recommendation.body} Confidence: ${recommendation.confidence}.`}
              tone={recommendation.tone}
            />
          ))}
        </div>
      </div>
      <div className="rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
        <p className="text-sm font-semibold text-white">Recommended Change</p>
        {recommendations[0]?.adds[0] ? (
          <div className="mt-4 space-y-4">
            <SwapRow
              label="Remove"
              name={recommendations[0].cuts[0]?.name ?? "Open deck slot"}
              note={recommendations[0].cuts[0]?.reason ?? "No current card selected."}
            />
            <SwapRow
              label="Add"
              name={recommendations[0].adds[0].name}
              note={recommendations[0].adds[0].additionalCost === null ? "Price unavailable" : `$${recommendations[0].adds[0].additionalCost.toFixed(2)} estimated`}
            />
            <p className="text-sm leading-6 text-slate-500">
              Why: {recommendations[0].adds[0].reason}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-[12px] bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-400" disabled>
                Apply after review unavailable
              </button>
              <button type="button" className="rounded-[12px] bg-black/25 px-4 py-2 text-sm font-semibold text-slate-300">
                Dismiss
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-slate-500">Build or select a deck with missing cards to receive recommendations.</p>
        )}
      </div>
    </section>
  );
}

function CardDetailDrawer({
  match,
  locked,
  mustInclude,
  onClose,
  toggleLocked,
  toggleMustInclude,
}: {
  match: OwnershipMatch;
  locked: boolean;
  mustInclude: boolean;
  onClose: () => void;
  toggleLocked: () => void;
  toggleMustInclude: () => void;
}) {
  const card = match.requirement;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${card.name} details`}>
      <div className="flex h-full w-full max-w-[460px] flex-col overflow-hidden rounded-[22px] bg-[#06131f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <p className="text-sm font-semibold text-white">Card details</p>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="mx-auto max-w-[280px] overflow-hidden rounded-[18px] bg-black/25">
            <CardImage card={card} />
          </div>
          <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">{card.name}</h3>
          <p className="mt-2 text-sm text-slate-500">{card.typeLine ?? "Card type unavailable"}</p>
          {card.oracleText ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-300">{card.oracleText}</p> : null}
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <Detail label="Required" value={String(card.requiredQuantity)} />
            <Detail label="Owned" value={String(match.ownedQuantity)} />
            <Detail label="Location" value={card.location ?? "Location unavailable"} />
            <Detail label="Price" value={card.estimatedPrice == null ? "Price unavailable" : `$${card.estimatedPrice.toFixed(2)}`} />
          </dl>
          <div className="mt-5 grid gap-3">
            <button type="button" onClick={toggleLocked} className="flex items-center justify-between rounded-[14px] bg-black/20 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45">
              <span>
                <span className="block text-sm font-semibold text-white">Lock</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Deck Architect cannot remove this card during optimization.</span>
              </span>
              <span className={locked ? "text-cyan-300" : "text-slate-600"}><Lock className="h-4 w-4" /></span>
            </button>
            <button type="button" onClick={toggleMustInclude} className="flex items-center justify-between rounded-[14px] bg-black/20 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45">
              <span>
                <span className="block text-sm font-semibold text-white">Must Include</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Deck Architect should preserve this card in rebuilds.</span>
              </span>
              <span className={mustInclude ? "text-cyan-300" : "text-slate-600"}><Star className="h-4 w-4" /></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function groupByRole(ownership: OwnershipMatch[]) {
  const groups = new Map<DeckArchitectRole, OwnershipMatch[]>();
  for (const match of ownership) {
    const primary = match.requirement.isCommander ? "synergy" : match.requirement.roles[0] ?? "synergy";
    groups.set(primary, [...(groups.get(primary) ?? []), match]);
  }
  return ROLE_ORDER
    .filter((role) => groups.has(role))
    .map((role) => [role, groups.get(role) ?? []] as [DeckArchitectRole, OwnershipMatch[]]);
}

function CardThumb({ card, size }: { card: Pick<CollectionGraphCard | DeckRequirement, "name" | "imageUri">; size: "small" | "large" }) {
  const classes = size === "large" ? "h-24 w-16" : "h-14 w-10";
  return (
    <div className={`${classes} shrink-0 overflow-hidden rounded-[10px] bg-slate-900`}>
      <CardImage card={card} />
    </div>
  );
}

function CardImage({ card }: { card: Pick<CollectionGraphCard | DeckRequirement, "name" | "imageUri"> }) {
  if (!card.imageUri) {
    return (
      <div className="flex aspect-[63/88] h-full w-full items-center justify-center bg-gradient-to-b from-slate-800 to-slate-950 p-3 text-center text-[10px] font-semibold leading-4 text-slate-500">
        {card.name}
      </div>
    );
  }
  return (
    <img
      src={card.imageUri}
      alt={`${card.name} card art`}
      loading="lazy"
      className="aspect-[63/88] h-full w-full object-cover"
    />
  );
}

function OwnershipPill({ match }: { match: OwnershipMatch }) {
  if (match.status === "owned") {
    return (
      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-200">
        <Check className="h-3 w-3" />
        Owned
      </span>
    );
  }
  if (match.status === "partial") {
    return (
      <span className="mt-2 inline-flex rounded-full bg-amber-300/10 px-2 py-1 text-[11px] font-semibold text-amber-200">
        {match.ownedQuantity} / {match.requirement.requiredQuantity} owned
      </span>
    );
  }
  return (
    <span className="mt-2 inline-flex rounded-full bg-slate-500/10 px-2 py-1 text-[11px] font-semibold text-slate-300">
      Missing
    </span>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-black/20 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.035em] text-white">{value}</p>
    </div>
  );
}

function InfoPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[20px] bg-[#06131f] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-cyan-300">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function HealthRow({ label, value }: { label: string; value: number }) {
  const readable = label.replace("-", " ");
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs capitalize text-slate-400">{readable}</p>
        <p className="text-sm font-semibold text-slate-200">{value}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
        <span className="block h-full rounded-full bg-cyan-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function IntelligenceItem({ title, body, tone }: { title: string; body: string; tone: "good" | "attention" | "neutral" }) {
  const color = tone === "good" ? "text-emerald-200" : tone === "attention" ? "text-amber-200" : "text-slate-200";
  return (
    <div className="rounded-[16px] bg-black/20 p-4">
      <p className={`text-sm font-semibold ${color}`}>{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

function SwapRow({ label, name, note }: { label: string; name: string; note: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{name}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function IconToggle({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45",
        active ? "bg-cyan-300/15 text-cyan-200" : "bg-black/25 text-slate-500 hover:text-slate-200",
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

function CenteredState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <section className="flex min-h-[520px] items-center justify-center rounded-[20px] bg-[#06131f] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.045)]">
      <div className="max-w-md">
        <Sparkles className="mx-auto h-8 w-8 text-cyan-300" />
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </section>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex rounded-[12px] bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#02131b]">
      {children}
    </Link>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-black/20 p-3">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-200">{value}</dd>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="mb-5 rounded-[18px] border border-amber-300/20 bg-amber-300/10 px-5 py-4">
      <p className="text-sm font-semibold text-amber-100">Deck Architect could not load your collection.</p>
      <p className="mt-1 text-sm text-amber-100/75">{message}</p>
    </div>
  );
}

function primaryRoleLabel(roles: DeckArchitectRole[]) {
  return (roles[0] ?? "synergy").replace("-", " ");
}
