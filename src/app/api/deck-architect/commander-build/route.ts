import { NextResponse } from "next/server";

import {
  constructValidatedCommanderDeck,
  fetchCommanderGlobalCandidates,
  isBuildIntentId,
  rankCommanderStrategiesForCollection,
  type CollectionGraphCard,
  type DeckBudgetConstraints,
} from "@/lib/deck-architect";
import { loadDeckArchitectCollectionSnapshot } from "@/lib/deck-architect/server";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import {
  canAccessHiddenDeckArchitect,
  DECK_ARCHITECT_VISIBLE,
} from "@/lib/product-visibility";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type BuildRequest = {
  commander?: Partial<CollectionGraphCard>;
  intentId?: unknown;
  strategyId?: string | null;
  budgetCents?: number | null;
  budget?: DeckBudgetConstraints | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in to build a deck." }, { status: 401 });
  }
  if (!DECK_ARCHITECT_VISIBLE) {
    const access = await resolvePlatformAccessForUser(supabase, user);
    if (!canAccessHiddenDeckArchitect(access)) {
      return NextResponse.json({ error: "Deck Architect is not available yet." }, { status: 403 });
    }
  }

  const payload = await request.json().catch(() => null) as BuildRequest | null;
  const commander = normalizeCommander(payload?.commander);
  const intentId = isBuildIntentId(payload?.intentId) ? payload.intentId : null;
  if (!commander || !intentId) {
    return NextResponse.json({ error: "Choose a valid commander and build intent." }, { status: 400 });
  }

  const snapshot = await loadDeckArchitectCollectionSnapshot(supabase, user);
  const collection = snapshot.cards;
  const strategyFits = rankCommanderStrategiesForCollection(commander, collection, intentId);
  const strategy = payload?.strategyId
    ? strategyFits.find((fit) => fit.strategy.id === payload.strategyId)?.strategy ?? strategyFits[0]?.strategy ?? null
    : strategyFits[0]?.strategy ?? null;
  const started = Date.now();
  const globalCandidates = await fetchCommanderGlobalCandidates({
    commander,
    strategy,
    intentId,
    budgetCents: payload?.budgetCents,
  });
  const result = constructValidatedCommanderDeck({
    commander,
    collection,
    intentId,
    strategyId: strategy?.id ?? payload?.strategyId ?? null,
    globalCandidates,
    budgetCents: payload?.budgetCents,
    budget: payload?.budget,
    candidateSource: "global-scryfall",
  });

  return NextResponse.json({
    ...result,
    performanceMs: Date.now() - started,
    globalCandidateCount: globalCandidates.length,
  });
}

function normalizeCommander(value: BuildRequest["commander"]): CollectionGraphCard | null {
  if (!value?.inventoryId || !value.name) return null;
  return {
    inventoryId: String(value.inventoryId),
    name: String(value.name),
    quantityOwned: Number(value.quantityOwned ?? 0),
    imageUri: value.imageUri ?? null,
    setCode: value.setCode ?? null,
    collectorNumber: value.collectorNumber ?? null,
    scryfallId: value.scryfallId ?? null,
    tcgplayerId: value.tcgplayerId ?? null,
    typeLine: value.typeLine ?? null,
    oracleText: value.oracleText ?? null,
    manaCost: value.manaCost ?? null,
    colors: value.colors ?? [],
    colorIdentity: value.colorIdentity ?? [],
    manaValue: value.manaValue ?? null,
    legalities: value.legalities ?? {},
    marketPrice: value.marketPrice ?? null,
  };
}
