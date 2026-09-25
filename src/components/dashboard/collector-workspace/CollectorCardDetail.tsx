"use client";

import Link from "next/link";
import { ArrowLeft, Check, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  TDButton,
  TDCard,
  TDEmptyState,
  TDErrorState,
  TDLoadingState,
  TDScreen,
  TDText,
} from "@/components/design-system/td-primitives";
import { createClient } from "@/lib/supabase/client";
import {
  loadWebCollectorCardById,
  runWebCollectorMutation,
  retryWebCollectorEdits,
} from "@/lib/collector-workspace-client-data";
import {
  CARD_CONDITION_OPTIONS,
  CARD_FINISH_OPTIONS,
  TRADE_BINDER_STATUS_OPTIONS,
} from "@/lib/collector-mutations";
import {
  changedMutations,
  draftFromCard,
  draftsEqual,
  type CollectorCardDetailDraft,
} from "@/lib/collector-card-detail-draft";
import {
  displayCondition,
  displayFinish,
  displayPrinting,
  priceLabel,
  type CollectionCard,
  type StorageLocation,
  type TradeBinderStatus,
} from "@/lib/collector-workspace";

type Draft = CollectorCardDetailDraft;

export function CollectorCardDetail({ cardId }: { cardId: string }) {
  const [card, setCard] = useState<CollectionCard | null>(null);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [draft, setDraft] = useState<Draft | null>(null);

  const refresh = useCallback(async () => {
    const result = await loadWebCollectorCardById(cardId);
    const nextCard = result.cards[0] ?? null;
    setCard(nextCard);
    setLocations(result.locations);
    setTotalQuantity(result.totalQuantity);
    setDraft(nextCard ? draftFromCard(nextCard) : null);
  }, [cardId]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth
      .getUser()
      .then((result: { data: { user: { id: string } | null } }) => {
        if (active) setUserId(result.data.user?.id ?? null);
      });
    void refresh()
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Card details are unavailable.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const dirty = Boolean(
    card && draft && !draftsEqual(draft, draftFromCard(card)),
  );
  const draftTotal =
    card && draft
      ? totalQuantity - card.quantityOwned + draft.quantity
      : totalQuantity;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const updateDraft = (patch: Partial<Draft>) => {
    setSaveState("idle");
    setSaveError(null);
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const saveChanges = async () => {
    if (!card || !draft || !userId || !dirty || saveState === "saving") return;
    setSaveState("saving");
    setSaveError(null);
    try {
      for (const mutation of changedMutations(card, draft, userId))
        await runWebCollectorMutation(mutation);
      await refresh();
      setSaveState("saved");
    } catch (saveFailure) {
      setSaveState("idle");
      setSaveError(
        saveFailure instanceof Error
          ? saveFailure.message
          : "Couldn’t save changes.",
      );
    }
  };

  if (loading)
    return (
      <TDScreen>
        <TDLoadingState
          title="Loading card"
          message="Fetching the exact saved printing."
        />
      </TDScreen>
    );
  if (error)
    return (
      <TDScreen>
        <TDErrorState
          title="Card unavailable"
          message={error}
          action={<BackLink dirty={false} />}
        />
      </TDScreen>
    );
  if (!card || !draft)
    return (
      <TDScreen>
        <TDEmptyState
          title="Card not found"
          message="This card is not available in the current collection data."
          action={<BackLink dirty={false} />}
        />
      </TDScreen>
    );

  return (
    <TDScreen className="space-y-5">
      <BackLink dirty={dirty} />
      <section className="grid gap-5 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3 lg:sticky lg:top-5 lg:self-start">
          <div className="overflow-hidden rounded-[var(--td-radius-xl)] border border-[var(--td-border-default)] bg-[var(--td-background-secondary)]">
            {card.printing.imageUrl ? (
              <img
                src={card.printing.imageUrl}
                alt={`${card.cardName} card image`}
                className="aspect-[0.72] h-auto w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[0.72] flex-col items-center justify-center gap-3 text-[var(--td-text-muted)]">
                <ImageIcon className="h-10 w-10" />
                <TDText tone="muted">Image unavailable</TDText>
              </div>
            )}
          </div>
          <TDCard className="grid grid-cols-2 gap-3">
            <DetailField
              label="Owned"
              value={`${draft.quantity} ${draft.quantity === 1 ? "copy" : "copies"}`}
            />
            <DetailField
              label="Price"
              value={priceLabel(card)}
              muted={card.marketPrice.amount === null}
            />
            <DetailField
              label="Collection total"
              value={draftTotal.toLocaleString()}
            />
            <DetailField label="Game" value={card.gameLabel} />
          </TDCard>
        </aside>

        <div className="min-w-0 space-y-4">
          <header className="border-b border-[var(--td-border-default)] pb-4">
            <TDText variant="label" tone="info">
              {displayPrinting(card.printing)}
            </TDText>
            <TDText as="h1" variant="display" className="mt-2 text-balance">
              {card.cardName}
            </TDText>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--td-text-muted)]">
              <span>{card.printing.setName ?? "Set name unavailable"}</span>
              <span>#{card.printing.collectorNumber ?? "?"}</span>
              <span>{card.printing.language ?? "Language unavailable"}</span>
            </div>
          </header>
          <TDCard className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField
              label="Condition"
              value={displayCondition(draft.condition)}
            />
            <DetailField label="Finish" value={displayFinish(draft.finish)} />
            <DetailField
              label="Storage"
              value={locationLabel(draft.storageLocationId, locations)}
            />
            <DetailField
              label="Trade"
              value={displayTradeStatus(draft.tradeStatus)}
            />
          </TDCard>
          <TDButton label="Recover pending edits" variant="secondary" disabled={saveState === "saving" || !userId} onClick={async () => {
            if (!userId) return;
            setSaveState("saving");
            try {
              const remaining = await retryWebCollectorEdits(userId);
              await refresh();
              setSaveError(remaining.length ? `${remaining.length} saved edit(s) still require review. Their original commands are preserved.` : null);
            } catch (failure) { setSaveError(failure instanceof Error ? failure.message : "Recovery unavailable."); }
            finally { setSaveState("idle"); }
          }} />
          {saveError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-300/25 bg-rose-300/[.06] px-4 py-3 text-sm text-rose-100"
            >
              <strong>Couldn’t save changes</strong>
              <span className="ml-2">{saveError}</span>
            </div>
          ) : null}
          {saveState === "saved" ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] px-4 py-3 text-sm text-emerald-100"
            >
              <Check className="h-4 w-4" /> Changes saved
            </div>
          ) : null}

          <TDCard className="space-y-6">
            <SectionHeading
              eyebrow="Inventory details"
              title="Edit saved inventory"
              description="Update the fields that describe this owned printing."
            />
            <div className="rounded-xl border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <TDText variant="label" tone="muted">
                    Quantity
                  </TDText>
                  <p className="mt-1 text-sm text-[var(--td-text-muted)]">
                    {draft.quantity === 0
                      ? "Zero owned; the record stays available."
                      : "Copies currently owned"}
                  </p>
                </div>
                <div
                  className="flex items-center gap-3"
                  aria-label="Quantity controls"
                >
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={draft.quantity <= 0 || saveState === "saving"}
                    onClick={() =>
                      updateDraft({ quantity: draft.quantity - 1 })
                    }
                    className="h-11 w-11 rounded-lg border border-[var(--td-border-default)] text-xl font-black text-[var(--td-text-primary)] hover:border-td-accent disabled:opacity-40"
                  >
                    −
                  </button>
                  <output
                    className="min-w-24 text-center text-base font-black tabular-nums text-[var(--td-text-primary)]"
                    aria-label={`${draft.quantity} copies`}
                  >
                    {draft.quantity} {draft.quantity === 1 ? "copy" : "copies"}
                  </output>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={saveState === "saving"}
                    onClick={() =>
                      updateDraft({ quantity: draft.quantity + 1 })
                    }
                    className="h-11 w-11 rounded-lg border border-[var(--td-border-default)] text-xl font-black text-[var(--td-text-primary)] hover:border-td-accent disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <CompactChoice
              label="Condition"
              value={draft.condition}
              options={CARD_CONDITION_OPTIONS}
              display={displayCondition}
              onSelect={(condition) => updateDraft({ condition })}
              disabled={saveState === "saving"}
            />
            <CompactChoice
              label="Finish"
              value={draft.finish}
              options={CARD_FINISH_OPTIONS}
              display={displayFinish}
              onSelect={(finish) => updateDraft({ finish })}
              disabled={saveState === "saving"}
            />
            <div className="space-y-2">
              <TDText variant="label" tone="muted">
                Storage location
              </TDText>
              <select
                aria-label="Storage location"
                value={draft.storageLocationId ?? "none"}
                disabled={saveState === "saving"}
                onChange={(event) =>
                  updateDraft({
                    storageLocationId:
                      event.target.value === "none" ? null : event.target.value,
                  })
                }
                className="h-11 w-full rounded-xl border border-[var(--td-border-default)] bg-[var(--td-background-secondary)] px-3 text-sm font-semibold text-[var(--td-text-primary)] outline-none focus:border-td-accent"
              >
                <option value="none">Unassigned</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.pathLabel && location.pathLabel !== location.name
                      ? ` · ${location.pathLabel}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </TDCard>

          <TDCard className="space-y-6">
            <SectionHeading
              eyebrow="Selling and organization"
              title="How this card is used"
              description="These preferences stay attached to this inventory record."
            />
            <CompactChoice
              label="Trade status"
              value={draft.tradeStatus}
              options={TRADE_BINDER_STATUS_OPTIONS}
              display={displayTradeStatus}
              onSelect={(tradeStatus) => updateDraft({ tradeStatus })}
              disabled={saveState === "saving"}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--td-border-default)] px-4 py-3">
              <div>
                <TDText variant="label" tone="muted">
                  Wishlist
                </TDText>
                <p className="mt-1 text-sm text-[var(--td-text-muted)]">
                  Keep this printing on your want list.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.wishlisted}
                onClick={() => updateDraft({ wishlisted: !draft.wishlisted })}
                disabled={saveState === "saving"}
                className={`min-h-11 rounded-lg border px-4 text-sm font-black transition ${draft.wishlisted ? "border-td-accent/50 bg-td-accent/15 text-td-accent-text" : "border-[var(--td-border-default)] text-[var(--td-text-secondary)]"}`}
              >
                {draft.wishlisted ? "On wishlist" : "Add to wishlist"}
              </button>
            </div>
          </TDCard>

          <TDCard variant="outlined" className="space-y-3">
            <SectionHeading
              eyebrow="Technical details"
              title="Reference metadata"
            />
            <DetailField
              label="Scryfall ID"
              value={card.printing.scryfallId ?? "Unavailable"}
            />
            <DetailField
              label="Set code"
              value={card.printing.setCode ?? "Unavailable"}
            />
          </TDCard>
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--td-border-default)] bg-[var(--td-background-secondary)]/95 p-3 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-[var(--td-text-muted)]">
              {dirty ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-td-accent" /> Unsaved
                  changes
                </>
              ) : saveState === "saved" ? (
                <>
                  <Check className="h-4 w-4 text-emerald-300" /> Changes saved
                </>
              ) : (
                "All changes saved"
              )}
            </div>
            <TDButton
              label={saveState === "saving" ? "Saving…" : "Save Changes"}
              disabled={!dirty || saveState === "saving"}
              onClick={() => void saveChanges()}
            />
          </div>
        </div>
      </section>
    </TDScreen>
  );
}

function locationLabel(id: string | null, locations: StorageLocation[]) {
  if (!id) return "Unassigned";
  const location = locations.find((candidate) => candidate.id === id);
  return location?.pathLabel && location.pathLabel !== location.name
    ? location.pathLabel
    : (location?.name ?? "Location unavailable");
}
function CompactChoice<T extends string>({
  label,
  value,
  options,
  display,
  onSelect,
  disabled,
}: {
  label: string;
  value: T;
  options: T[];
  display: (value: T) => string;
  onSelect: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <TDText variant="label" tone="muted">
        {label}
      </TDText>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            disabled={disabled || option === value}
            onClick={() => onSelect(option)}
            className={`min-h-10 rounded-lg border px-3 py-2 text-left text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-accent disabled:opacity-70 ${option === value ? "border-td-accent/50 bg-td-accent/15 text-td-accent-text" : "border-[var(--td-border-default)] text-[var(--td-text-muted)] hover:border-td-accent/40 hover:text-[var(--td-text-primary)]"}`}
          >
            {display(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
function displayTradeStatus(status: Exclude<TradeBinderStatus, "unknown">) {
  return {
    not_for_trade: "Not for trade",
    available: "Available",
    reserved: "Reserved",
    pending: "Pending",
    looking_for_upgrade: "Looking for upgrade",
    for_sale: "For sale",
  }[status];
}
function BackLink({ dirty }: { dirty: boolean }) {
  return (
    <Link
      href="/dashboard/inventory"
      onClick={(event) => {
        if (
          dirty &&
          !window.confirm("You have unsaved changes. Leave this page?")
        )
          event.preventDefault();
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--td-radius-md)] border border-[var(--td-border-default)] px-3 text-sm font-black text-[var(--td-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--td-border-focus)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Collection
    </Link>
  );
}
function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <TDText variant="label" tone="info">
          {eyebrow}
        </TDText>
      ) : null}
      <TDText variant="title" className={eyebrow ? "mt-1" : undefined}>
        {title}
      </TDText>
      {description ? (
        <TDText tone="muted" className="mt-1">
          {description}
        </TDText>
      ) : null}
    </div>
  );
}
function DetailField({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <TDText variant="caption" tone="muted">
        {label}
      </TDText>
      <TDText variant="small" tone={muted ? "muted" : "primary"}>
        {value}
      </TDText>
    </div>
  );
}
