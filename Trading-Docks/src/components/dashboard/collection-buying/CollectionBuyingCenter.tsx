"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Coins,
  Download,
  FileJson,
  FileSpreadsheet,
  Gauge,
  History,
  ListFilter,
  Loader2,
  PackageSearch,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";
import {
  CardPreviewPortal,
  type PreviewState,
} from "./CardPreviewPortal";
import { CsvImportModal } from "./CsvImportModal";
import {
  PrintingPickerModal,
  type PrintingPickerRequest,
} from "./PrintingPickerModal";
import {
  applyOfferMode,
  cardImage,
  CONDITION_MULTIPLIERS,
  estimateCardEconomics,
  hydrateAppraisalCard,
  parseCollectionText,
  resolveCard,
  resolveCollection,
  searchPrintings,
} from "./scryfall";
import type {
  AppraisalCard,
  BuyingSettings,
  Condition,
  OfferMode,
  PriceFinish,
  SavedAppraisal,
  ScryfallCard,
} from "./types";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "trading-docks-collection-appraisals-v1";
const DRAFT_KEY = "trading-docks-collection-buying-draft-v1";

const DEFAULT_SETTINGS: BuyingSettings = {
  offerMode: "balanced",
  customOfferPercent: 65,
  feePercent: 13.25,
  shippingPerOrder: 1.25,
  averageCardsPerOrder: 2.4,
  laborPerCard: 0.35,
  targetMarginPercent: 22,
  cashAdjustmentPercent: 0,
  storeCreditBonusPercent: 15,
  minimumPricedCard: 0.5,
};

const DEMO_INPUT = `2 Rhystic Study [WOT] NM
1 Ancient Tomb [TMP] LP
4 Sol Ring [CMM] NM
1 Cyclonic Rift [RTR] LP
2 Smothering Tithe [RNA] NM
1 Demonic Tutor [STA] NM`;

export function CollectionBuyingCenter() {
  const [accountId, setAccountId] = useState("");
  const [accountDataReady, setAccountDataReady] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [cards, setCards] = useState<AppraisalCard[]>([]);
  const [settings, setSettings] =
    useState<BuyingSettings>(DEFAULT_SETTINGS);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [notes, setNotes] = useState("");
  const [customerLookupPhone, setCustomerLookupPhone] = useState("");
  const [customerLookupResult, setCustomerLookupResult] = useState<{
    name: string;
    phone: string;
    loyaltyPoints: number;
    storeCredit: number;
    visits: number;
  } | null>(null);
  const [appraisalStatus, setAppraisalStatus] =
    useState<SavedAppraisal["status"]>("draft");
  const [isPricing, setIsPricing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [savedAppraisals, setSavedAppraisals] = useState<SavedAppraisal[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [printingPicker, setPrintingPicker] =
    useState<PrintingPickerRequest>(null);
  const [preferredSetCode, setPreferredSetCode] = useState("");
  const [rememberedFinish, setRememberedFinish] =
    useState<PriceFinish>("nonfoil");
  const [rememberedCondition, setRememberedCondition] =
    useState<Condition>("NM");
  const [lockPreferredSet, setLockPreferredSet] = useState(true);
  const [tableSearch, setTableSearch] = useState("");
  const [highValueOnly, setHighValueOnly] = useState(false);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [toast, setToast] = useState("");

  useEffect(() => {
    void (async () => {
    try {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) return;
      setAccountId(user.id);
      const saved = window.localStorage.getItem(`${STORAGE_KEY}:${user.id}`);
      if (saved) setSavedAppraisals(JSON.parse(saved));

      const preferences = window.localStorage.getItem(
        `trading-docks-buying-printing-preferences-v1:${user.id}`,
      );
      if (preferences) {
        const parsedPreferences = JSON.parse(preferences);
        setPreferredSetCode(parsedPreferences.preferredSetCode ?? "");
        setRememberedFinish(
          parsedPreferences.rememberedFinish ?? "nonfoil",
        );
        setRememberedCondition(
          parsedPreferences.rememberedCondition ?? "NM",
        );
        setLockPreferredSet(parsedPreferences.lockPreferredSet ?? true);
      }

      const draft = window.localStorage.getItem(`${DRAFT_KEY}:${user.id}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        setRawInput(parsed.rawInput ?? "");
        setCards(parsed.cards ?? []);
        setSettings({ ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) });
        setCustomerName(parsed.customerName ?? "");
        setCustomerContact(parsed.customerContact ?? "");
        setEmployeeName(parsed.employeeName ?? "");
        setNotes(parsed.notes ?? "");
        setAppraisalStatus(parsed.appraisalStatus ?? "draft");
      }
    } catch {
      // Invalid account data is ignored and replaced only after initialization.
    } finally {
      setAccountDataReady(true);
    }
    })();
  }, []);

  useEffect(() => {
    if (!accountDataReady || !accountId) return;
    window.localStorage.setItem(
      `trading-docks-buying-printing-preferences-v1:${accountId}`,
      JSON.stringify({
        preferredSetCode,
        rememberedFinish,
        rememberedCondition,
        lockPreferredSet,
      }),
    );
  }, [
    preferredSetCode,
    rememberedFinish,
    rememberedCondition,
    lockPreferredSet, accountDataReady, accountId,
  ]);

  useEffect(() => {
    if (!accountDataReady || !accountId) return;
    window.localStorage.setItem(
      `${DRAFT_KEY}:${accountId}`,
      JSON.stringify({
        rawInput,
        cards,
        settings,
        customerName,
        customerContact,
        employeeName,
        notes,
        customerLookupPhone,
        customerLookupResult,
        appraisalStatus,
      }),
    );
  }, [
    rawInput,
    cards,
    settings,
    customerName,
    customerContact,
    employeeName,
    notes,
    customerLookupPhone,
    customerLookupResult,
    appraisalStatus, accountDataReady, accountId,
  ]);

  const readyCards = cards.filter(
    (card) => card.status === "ready" && card.card,
  );

  const totals = useMemo(() => {
    const market = readyCards.reduce(
      (sum, item) => sum + item.lineMarketValue,
      0,
    );

    const economics = readyCards.map((item) =>
      estimateCardEconomics(item, settings),
    );

    const cashOffer = economics.reduce((sum, item) => sum + item.offer, 0);
    const fees = economics.reduce((sum, item) => sum + item.fee, 0);
    const shipping = economics.reduce((sum, item) => sum + item.shipping, 0);
    const labor = economics.reduce((sum, item) => sum + item.labor, 0);
    const projectedNet = economics.reduce(
      (sum, item) => sum + item.projectedNet,
      0,
    );
    const projectedProfit = projectedNet - cashOffer;
    const averageOfferPercent =
      market > 0 ? (cashOffer / market) * 100 : 0;
    const projectedMargin =
      projectedNet > 0 ? (projectedProfit / projectedNet) * 100 : 0;

    return {
      market,
      cashOffer,
      storeCreditOffer:
        cashOffer * (1 + settings.storeCreditBonusPercent / 100),
      fees,
      shipping,
      labor,
      projectedNet,
      projectedProfit,
      averageOfferPercent,
      projectedMargin,
      units: readyCards.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [readyCards, settings]);

  const riskProfile = useMemo(() => {
    if (!readyCards.length) {
      return {
        score: 0,
        label: "Not calculated",
        tone: "text-slate-500",
        reasons: ["Add and price cards to calculate collection risk."],
      };
    }

    let score = 50;
    const reasons: string[] = [];
    const highLiquidity = readyCards.filter(
      (item) => (item.card?.edhrec_rank ?? 999999) <= 2500,
    ).length;
    const reserved = readyCards.filter((item) => item.card?.reserved).length;
    const lowValue = readyCards.filter(
      (item) => item.adjustedUnitValue < 2,
    ).length;
    const overstocked = readyCards.filter(
      (item) => item.ownedQuantity >= 10,
    ).length;

    score += (highLiquidity / readyCards.length) * 25;
    score += (reserved / readyCards.length) * 12;
    score -= (lowValue / readyCards.length) * 22;
    score -= (overstocked / readyCards.length) * 18;
    score = Math.max(0, Math.min(100, score));

    if (highLiquidity) {
      reasons.push(
        `${highLiquidity} line${highLiquidity === 1 ? "" : "s"} show strong Commander demand.`,
      );
    }
    if (reserved) {
      reasons.push(
        `${reserved} Reserved List line${reserved === 1 ? "" : "s"} reduce reprint exposure.`,
      );
    }
    if (lowValue) {
      reasons.push(
        `${lowValue} low-value line${lowValue === 1 ? "" : "s"} may require extra labor to sell.`,
      );
    }
    if (overstocked) {
      reasons.push(
        `${overstocked} line${overstocked === 1 ? "" : "s"} may add to existing overstock.`,
      );
    }
    if (!reasons.length) {
      reasons.push("The collection has a balanced mix of value and demand.");
    }

    return {
      score,
      label:
        score >= 72
          ? "Low risk"
          : score >= 52
            ? "Moderate risk"
            : "Higher risk",
      tone:
        score >= 72
          ? "text-emerald-300"
          : score >= 52
            ? "text-amber-300"
            : "text-red-300",
      reasons,
    };
  }, [readyCards]);

  async function priceCollection() {
    const parsedRows = parseCollectionText(rawInput);

    if (!parsedRows.length) {
      notify("Paste or enter at least one card.");
      return;
    }

    await priceParsedRows(parsedRows);
  }

  async function priceParsedRows(
    parsedRows: ReturnType<typeof parseCollectionText>,
  ) {
    const initialRows: AppraisalCard[] = parsedRows.map((row) => ({
      ...row,
      rowId: crypto.randomUUID(),
      status: "loading",
      unitMarket: 0,
      conditionMultiplier: CONDITION_MULTIPLIERS[row.condition],
      adjustedUnitValue: 0,
      lineMarketValue: 0,
      suggestedPercent: 0,
      ownedQuantity: 0,
    }));

    setCards(initialRows);
    setIsPricing(true);
    setProgress({ current: 0, total: parsedRows.length });

    await resolveCollection(
      parsedRows,
      (index, resolvedCard?: ScryfallCard, error?: string) => {
        setCards((current) =>
          current.map((row, rowIndex) => {
            if (rowIndex !== index) return row;

            if (!resolvedCard) {
              return {
                ...row,
                status: "error",
                error: error ?? "Card not found.",
              };
            }

            const rowInput = parsedRows[index];
            const effectiveInput = {
              ...rowInput,
              finish:
                rowInput.finish === "nonfoil"
                  ? rememberedFinish
                  : rowInput.finish,
              condition:
                rowInput.condition === "NM"
                  ? rememberedCondition
                  : rowInput.condition,
            };

            return hydrateAppraisalCard(
              effectiveInput,
              resolvedCard,
              settings,
              row,
            );
          }),
        );

        setProgress({
          current: index + 1,
          total: parsedRows.length,
        });
      },
    );

    if (lockPreferredSet && preferredSetCode) {
      await applyPreferredSetToResolvedRows(
        parsedRows,
        preferredSetCode,
      );
    }

    setIsPricing(false);
    notify(
      `${parsedRows.length.toLocaleString("en-US")} collection rows priced from Scryfall.`,
    );
  }

  async function applyPreferredSetToResolvedRows(
    parsedRows: ReturnType<typeof parseCollectionText>,
    setCode: string,
  ) {
    const normalizedSet = setCode.trim().toLowerCase();
    if (!normalizedSet) return;

    for (let index = 0; index < parsedRows.length; index += 1) {
      const row = parsedRows[index];

      try {
        const preferred = await resolveCard({
          ...row,
          setCode: normalizedSet,
          collectorNumber: undefined,
          finish:
            row.finish === "nonfoil" ? rememberedFinish : row.finish,
          condition:
            row.condition === "NM" ? rememberedCondition : row.condition,
        });

        setCards((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index && preferred
              ? hydrateAppraisalCard(
                  {
                    ...row,
                    setCode: preferred.set,
                    collectorNumber: preferred.collector_number,
                    finish:
                      row.finish === "nonfoil"
                        ? rememberedFinish
                        : row.finish,
                    condition:
                      row.condition === "NM"
                        ? rememberedCondition
                        : row.condition,
                  },
                  preferred,
                  settings,
                  item,
                )
              : item,
          ),
        );
      } catch {
        // The card does not exist in the preferred set. Keep the resolved
        // Scryfall printing instead of interrupting the buying workflow.
      }
    }
  }

  async function importCsvRows(
    rows: ReturnType<typeof parseCollectionText>,
    filename: string,
  ) {
    setRawInput(rows.map((row) => row.raw).join("\\n"));
    await priceParsedRows(rows);
    notify(`${filename} imported successfully.`);
  }

  function selectPrinting(
    rowId: string,
    selectedCard: ScryfallCard,
    options?: {
      rememberSet?: boolean;
      rememberFinish?: boolean;
      rememberCondition?: boolean;
      finish?: PriceFinish;
      condition?: Condition;
      applyToAllCopies?: boolean;
    },
  ) {
    const finish = options?.finish ?? rememberedFinish;
    const condition = options?.condition ?? rememberedCondition;

    if (options?.rememberSet) {
      setPreferredSetCode(selectedCard.set);
      setLockPreferredSet(true);
    }

    if (options?.rememberFinish) {
      setRememberedFinish(finish);
    }

    if (options?.rememberCondition) {
      setRememberedCondition(condition);
    }

    setCards((current) => {
      const source = current.find((item) => item.rowId === rowId);
      const targetName = selectedCard.name.toLowerCase();

      return current.map((item) => {
        const shouldUpdate =
          item.rowId === rowId ||
          Boolean(
            options?.applyToAllCopies &&
              (item.card?.name ?? item.name).toLowerCase() === targetName,
          );

        if (!shouldUpdate) return item;

        const effectiveFinish =
          finish === "foil" && !selectedCard.prices.usd_foil
            ? selectedCard.prices.usd
              ? "nonfoil"
              : finish
            : finish === "etched" && !selectedCard.prices.usd_etched
              ? selectedCard.prices.usd
                ? "nonfoil"
                : finish
              : finish;

        return hydrateAppraisalCard(
          {
            raw: item.raw,
            quantity: item.quantity,
            name: selectedCard.name,
            setCode: selectedCard.set,
            collectorNumber: selectedCard.collector_number,
            finish: effectiveFinish,
            condition,
          },
          selectedCard,
          settings,
          {
            ...item,
            finish: effectiveFinish,
            condition,
            ownedQuantity: item.ownedQuantity,
          },
        );
      });
    });

    setPrintingPicker(null);
    notify(
      options?.applyToAllCopies
        ? "Printing applied to all matching copies."
        : "Card printing updated and remembered.",
    );
  }

  function applyRowDefaults(
    rowId: string,
    finish: PriceFinish,
    condition: Condition,
  ) {
    setRememberedFinish(finish);
    setRememberedCondition(condition);
    updateCard(rowId, { finish, condition });
    setPrintingPicker(null);
    notify("Finish and condition defaults updated.");
  }

  function clearPreferredSet() {
    setPreferredSetCode("");
    setLockPreferredSet(false);
    notify("Preferred set cleared.");
  }

  function purchaseCollection() {
    if (!readyCards.length) {
      notify("Price a collection before purchasing it.");
      return;
    }

    const purchase = {
      id: crypto.randomUUID(),
      customerName: customerName.trim() || "Walk-in Customer",
      createdAt: new Date().toISOString(),
      intakeLocation: "Incoming Collections",
      status: "awaiting-sorting",
      cashPaid: totals.cashOffer,
      cards: readyCards,
    };

    if (!accountId) return;
    const key = `trading-docks-purchased-collections-v1:${accountId}`;
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    window.localStorage.setItem(
      key,
      JSON.stringify([purchase, ...existing].slice(0, 250)),
    );

    saveAppraisal("accepted");
    notify("Collection purchased and queued in Incoming Collections.");
  }

  function updateCard(
    rowId: string,
    patch: Partial<AppraisalCard>,
  ) {
    setCards((current) =>
      current.map((item) => {
        if (item.rowId !== rowId) return item;

        const next = { ...item, ...patch };
        const conditionMultiplier =
          CONDITION_MULTIPLIERS[next.condition];
        const adjustedUnitValue =
          next.unitMarket * conditionMultiplier;

        return {
          ...next,
          conditionMultiplier,
          adjustedUnitValue,
          lineMarketValue: adjustedUnitValue * next.quantity,
        };
      }),
    );
  }

  function removeCard(rowId: string) {
    setCards((current) =>
      current.filter((item) => item.rowId !== rowId),
    );
  }

  function saveAppraisal(status: SavedAppraisal["status"] = appraisalStatus) {
    if (!cards.length) {
      notify("Price a collection before saving.");
      return;
    }

    const appraisal: SavedAppraisal = {
      id: crypto.randomUUID(),
      customerName: customerName.trim() || "Walk-in Customer",
      customerContact: customerContact.trim(),
      employeeName: employeeName.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      status,
      settings,
      cards,
    };

    const next = [appraisal, ...savedAppraisals].slice(0, 100);
    setSavedAppraisals(next);
    window.localStorage.setItem(`${STORAGE_KEY}:${accountId}`, JSON.stringify(next));
    setAppraisalStatus(status);
    notify("Appraisal saved to buying history.");
  }

  function loadAppraisal(appraisal: SavedAppraisal) {
    setCards(appraisal.cards);
    setSettings({ ...DEFAULT_SETTINGS, ...appraisal.settings });
    setCustomerName(appraisal.customerName);
    setCustomerContact(appraisal.customerContact);
    setEmployeeName(appraisal.employeeName);
    setNotes(appraisal.notes);
    setAppraisalStatus(appraisal.status);
    setHistoryOpen(false);
    notify("Saved appraisal loaded.");
  }

  function resetAppraisal() {
    setRawInput("");
    setCards([]);
    setCustomerName("");
    setCustomerContact("");
    setNotes("");
    setCustomerLookupPhone("");
    setCustomerLookupResult(null);
    setAppraisalStatus("draft");
    setInventoryPage(1);
    setProgress({ current: 0, total: 0 });
    if (accountId) window.localStorage.removeItem(`${DRAFT_KEY}:${accountId}`);
    notify("Started a new collection appraisal.");
  }

  function searchCustomerByPhone() {
    const normalized = customerLookupPhone.replace(/\D/g, "");

    if (normalized.length < 7) {
      notify("Enter a valid phone number.");
      return;
    }

    const storedCustomers = JSON.parse(
      window.localStorage.getItem(
        `trading-docks-customer-loyalty-v1:${accountId}`,
      ) ?? "[]",
    ) as Array<{
      name: string;
      phone: string;
      loyaltyPoints: number;
      storeCredit: number;
      visits: number;
    }>;

    const match = storedCustomers.find(
      (customer) =>
        customer.phone.replace(/\D/g, "") === normalized,
    );

    if (match) {
      setCustomerLookupResult(match);
      setCustomerName(match.name);
      setCustomerContact(match.phone);
      notify("Customer loyalty profile found.");
      return;
    }

    setCustomerLookupResult({
      name: "New Customer",
      phone: customerLookupPhone,
      loyaltyPoints: 0,
      storeCredit: 0,
      visits: 0,
    });
    notify("No existing profile found. Ready to create one.");
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Front Counter Buying"
        title="Collection Buying Center"
        description="Price walk-in collections with current Scryfall estimates, calculate a protected buy offer, account for selling expenses, and save a complete appraisal history."
        icon={WalletCards}
        actionLabel="Price collection"
        onAction={priceCollection}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Collection market"
          value={currency(totals.market)}
          detail={`${totals.units} total cards`}
          icon={TrendingUp}
        />
        <MetricCard
          label="Recommended cash"
          value={currency(totals.cashOffer)}
          detail={`${totals.averageOfferPercent.toFixed(1)}% blended offer`}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Store credit"
          value={currency(totals.storeCreditOffer)}
          detail={`${settings.storeCreditBonusPercent}% credit bonus`}
          icon={Coins}
        />
        <MetricCard
          label="Projected profit"
          value={currency(totals.projectedProfit)}
          detail={`${totals.projectedMargin.toFixed(1)}% projected margin`}
          icon={BadgeDollarSign}
        />
        <MetricCard
          label="Collection risk"
          value={riskProfile.label}
          detail={`${Math.round(riskProfile.score)}/100 quality score`}
          icon={ShieldCheck}
        />
      </div>

      <section className={`${styles.glassPanel} print-hide mt-5 rounded-[26px] p-4`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={Plus}
              label="New appraisal"
              onClick={resetAppraisal}
            />
            <ActionButton
              icon={Upload}
              label="Import CSV"
              onClick={() => setCsvImportOpen(true)}
            />
            <ActionButton
              icon={Save}
              label="Save draft"
              onClick={() => saveAppraisal("draft")}
            />
            <ActionButton
              icon={History}
              label="Buying history"
              onClick={() => setHistoryOpen(true)}
            />
            <ActionButton
              icon={Gauge}
              label="Buying rules"
              onClick={() => setSettingsOpen(true)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={FileSpreadsheet}
              label="Export CSV"
              onClick={() =>
                exportCsv(cards, settings, customerName, totals.cashOffer)
              }
            />
            <ActionButton
              icon={FileJson}
              label="Export JSON"
              onClick={() =>
                exportJson({
                  customerName,
                  customerContact,
                  employeeName,
                  notes,
                  status: appraisalStatus,
                  settings,
                  cards,
                  totals,
                })
              }
            />
            <ActionButton
              icon={Printer}
              label="Print offer"
              onClick={() => window.print()}
            />
          </div>
        </div>
      </section>

      <section className={`${styles.glassPanel} print-hide mt-5 rounded-[24px] p-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-violet-300">
              Session Defaults
            </p>
            <p className="mt-1 text-[9px] text-slate-600">
              New cards inherit the preferred set, finish, and condition when available.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SessionPill
              label="Preferred set"
              value={
                preferredSetCode
                  ? preferredSetCode.toUpperCase()
                  : "Scryfall default"
              }
            />
            <SessionPill
              label="Finish"
              value={capitalize(rememberedFinish)}
            />
            <SessionPill
              label="Condition"
              value={rememberedCondition}
            />
            {preferredSetCode ? (
              <button
                type="button"
                onClick={clearPreferredSet}
                className="h-9 rounded-xl border border-white/[0.065] bg-white/[0.02] px-3 text-[8px] font-semibold text-slate-500 hover:text-red-200"
              >
                Clear preferred set
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="collection-buying-layout print-hide mt-5 grid gap-5">
        <div className="space-y-5">
          <CollectionEntryPanel
            rawInput={rawInput}
            setRawInput={setRawInput}
            isPricing={isPricing}
            progress={progress}
            onPrice={priceCollection}
            onDemo={() => setRawInput(DEMO_INPUT)}
          />

          <CustomerPanel
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerContact={customerContact}
            setCustomerContact={setCustomerContact}
            employeeName={employeeName}
            setEmployeeName={setEmployeeName}
            notes={notes}
            setNotes={setNotes}
            lookupPhone={customerLookupPhone}
            setLookupPhone={setCustomerLookupPhone}
            lookupResult={customerLookupResult}
            onLookup={searchCustomerByPhone}
          />
        </div>

        <CollectionTable
          cards={cards}
          settings={settings}
          search={tableSearch}
          setSearch={(value) => {
            setTableSearch(value);
            setInventoryPage(1);
          }}
          highValueOnly={highValueOnly}
          setHighValueOnly={(value) => {
            setHighValueOnly(value);
            setInventoryPage(1);
          }}
          page={inventoryPage}
          setPage={setInventoryPage}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={(value) => {
            setRowsPerPage(value);
            setInventoryPage(1);
          }}
          onUpdate={updateCard}
          onRemove={removeCard}
          onChangePrinting={(item) =>
            setPrintingPicker({ item })
          }
          onPreview={setPreview}
        />

        <div className="space-y-5">
          <OfferSummary
            totals={totals}
            settings={settings}
            appraisalStatus={appraisalStatus}
            setAppraisalStatus={setAppraisalStatus}
            onSave={saveAppraisal}
            onPurchase={purchaseCollection}
          />
          <RiskPanel profile={riskProfile} cards={readyCards} />
          <ProfitPanel totals={totals} settings={settings} />
        </div>
      </div>

      <BuyingIntelligence cards={readyCards} settings={settings} />

      <PrintableCustomerOffer
        cards={readyCards}
        settings={settings}
        customerName={customerName}
        employeeName={employeeName}
        totals={totals}
      />

      <CardPreviewPortal
        preview={preview}
        settings={settings}
        onClose={() => setPreview(null)}
      />

      <PrintingPickerModal
        request={printingPicker}
        rememberedSetCode={preferredSetCode}
        rememberedFinish={rememberedFinish}
        rememberedCondition={rememberedCondition}
        onClose={() => setPrintingPicker(null)}
        onChoose={(rowId, printing, options) =>
          selectPrinting(rowId, printing, options)
        }
        onApplyDefaults={applyRowDefaults}
      />

      <CsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImport={importCsvRows}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        setSettings={setSettings}
        onClose={() => setSettingsOpen(false)}
      />

      <HistoryModal
        open={historyOpen}
        appraisals={savedAppraisals}
        onClose={() => setHistoryOpen(false)}
        onLoad={loadAppraisal}
        onDelete={(id) => {
          const next = savedAppraisals.filter(
            (appraisal) => appraisal.id !== id,
          );
          setSavedAppraisals(next);
          window.localStorage.setItem(`${STORAGE_KEY}:${accountId}`, JSON.stringify(next));
        }}
      />

      <style jsx global>{`
        .collection-buying-layout {
          grid-template-columns: minmax(0, 1fr);
        }

        .inventory-card-layout {
          grid-template-columns: minmax(0, 1fr);
        }

        @media (min-width: 1280px) {
          .collection-buying-layout {
            grid-template-columns:
              minmax(260px, 0.78fr)
              minmax(0, 1.62fr)
              minmax(280px, 0.82fr);
          }

          .inventory-card-layout {
            grid-template-columns:
              minmax(320px, 1.58fr)
              minmax(210px, 0.88fr)
              minmax(124px, 0.44fr);
            align-items: center;
          }
        }

        @media print {
          body {
            background: #ffffff !important;
            color: #111827 !important;
          }

          body * {
            visibility: hidden !important;
          }

          .print-offer,
          .print-offer * {
            visibility: visible !important;
          }

          .print-offer {
            display: block !important;
            position: absolute;
            inset: 0;
            width: 100%;
            padding: 28px 34px;
            background: #ffffff;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
          }

          .print-header {
            display: flex;
            justify-content: space-between;
            gap: 28px;
            padding-bottom: 18px;
            border-bottom: 2px solid #111827;
          }

          .print-header h1 {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
          }

          .print-header > div > p {
            margin: 5px 0 0;
            font-size: 14px;
          }

          .print-meta {
            text-align: right;
            font-size: 11px;
          }

          .print-meta p {
            margin: 0 0 5px;
          }

          .print-table {
            width: 100%;
            margin-top: 24px;
            border-collapse: collapse;
            font-size: 10px;
          }

          .print-table th {
            padding: 9px 7px;
            border-bottom: 1px solid #111827;
            text-align: left;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .print-table td {
            padding: 8px 7px;
            border-bottom: 1px solid #d1d5db;
          }

          .print-table th:last-child,
          .print-table td:last-child {
            text-align: right;
          }

          .print-totals {
            width: 320px;
            margin: 24px 0 0 auto;
            border: 1px solid #111827;
          }

          .print-totals > div {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 12px 14px;
          }

          .print-totals > div + div {
            border-top: 1px solid #d1d5db;
          }

          .print-totals strong {
            font-size: 16px;
          }

          .print-terms {
            margin-top: 30px;
            font-size: 9px;
            line-height: 1.5;
          }

          .print-signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 48px;
            margin-top: 42px;
          }

          .print-signatures span {
            padding-top: 7px;
            border-top: 1px solid #111827;
          }

          @page {
            size: auto;
            margin: 0.45in;
          }
        }
      `}</style>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[150] flex items-center gap-2 rounded-xl border border-cyan-300/[0.15] bg-[#06131d]/96 px-4 py-3 text-[10px] font-semibold text-cyan-100 shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <Check className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      ) : null}
    </WorkspaceFrame>
  );
}

function CollectionEntryPanel({
  rawInput,
  setRawInput,
  isPricing,
  progress,
  onPrice,
  onDemo,
}: {
  rawInput: string;
  setRawInput: (value: string) => void;
  isPricing: boolean;
  progress: { current: number; total: number };
  onPrice: () => void;
  onDemo: () => void;
}) {
  return (
    <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Quick Entry
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Paste 20–30 cards
          </h2>
        </div>
        <PackageSearch className="h-4 w-4 text-cyan-300" />
      </div>

      <p className="mt-2 text-[9px] leading-4 text-slate-600">
        One card per line. Use quantity, optional set code, finish, and
        condition.
      </p>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/[0.1] px-3 py-2.5 text-[8px] leading-4 text-slate-600">
        <span className="text-slate-400">Examples:</span>
        <br />
        2 Rhystic Study [WOT] NM
        <br />
        1 Ancient Tomb [TMP #315] LP
        <br />
        3 Sol Ring [CMM] FOIL NM
      </div>

      <textarea
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
        placeholder="Enter collection cards here..."
        className="mt-4 min-h-[260px] w-full resize-y rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-[11px] leading-6 text-slate-300 outline-none placeholder:text-slate-700 focus:border-cyan-300/[0.22]"
      />

      {isPricing ? (
        <div className="mt-4">
          <div className="flex justify-between text-[8px] text-slate-600">
            <span>Retrieving Scryfall prices</span>
            <span>
              {progress.current}/{progress.total}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all"
              style={{
                width: `${
                  progress.total
                    ? (progress.current / progress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDemo}
          className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] text-[9px] font-semibold text-slate-500"
        >
          Load example
        </button>
        <button
          type="button"
          onClick={onPrice}
          disabled={isPricing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 text-[9px] font-semibold text-[#001018] disabled:opacity-50"
        >
          {isPricing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {isPricing ? "Pricing..." : "Price collection"}
        </button>
      </div>
    </section>
  );
}

function CustomerPanel({
  customerName,
  setCustomerName,
  customerContact,
  setCustomerContact,
  employeeName,
  setEmployeeName,
  notes,
  setNotes,
  lookupPhone,
  setLookupPhone,
  lookupResult,
  onLookup,
}: {
  customerName: string;
  setCustomerName: (value: string) => void;
  customerContact: string;
  setCustomerContact: (value: string) => void;
  employeeName: string;
  setEmployeeName: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  lookupPhone: string;
  setLookupPhone: (value: string) => void;
  lookupResult: {
    name: string;
    phone: string;
    loyaltyPoints: number;
    storeCredit: number;
    visits: number;
  } | null;
  onLookup: () => void;
}) {
  return (
    <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/[0.1] bg-violet-400/[0.04] text-violet-300">
          <UserRound className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-200">
            Customer details
          </p>
          <p className="mt-1 text-[8px] text-slate-700">
            Appraisal and loyalty information
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-300/[0.1] bg-cyan-400/[0.025] p-3.5">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-cyan-300" />
          <p className="text-[9px] font-semibold text-cyan-100">
            Find customer by phone
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={lookupPhone}
            onChange={(event) => setLookupPhone(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onLookup();
            }}
            placeholder="Search phone number"
            inputMode="tel"
            className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.065] bg-white/[0.02] px-3 text-[10px] text-slate-300 outline-none placeholder:text-slate-700 focus:border-cyan-300/[0.18]"
          />
          <button
            type="button"
            onClick={onLookup}
            className="h-10 shrink-0 rounded-xl border border-cyan-300/[0.15] bg-cyan-400/[0.05] px-3 text-[8px] font-semibold text-cyan-200"
          >
            Search
          </button>
        </div>

        {lookupResult ? (
          <div className="mt-3 rounded-xl border border-white/[0.055] bg-black/[0.1] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold text-slate-200">
                  {lookupResult.name}
                </p>
                <p className="mt-1 text-[8px] text-slate-700">
                  {lookupResult.visits
                    ? `${lookupResult.visits} previous visits`
                    : "No previous visits"}
                </p>
              </div>
              <span className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[7px] text-slate-600">
                {lookupResult.visits ? "Existing" : "New"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-violet-300/[0.09] bg-violet-400/[0.03] px-2.5 py-2">
                <p className="text-[7px] uppercase tracking-[0.11em] text-violet-300/70">
                  Loyalty points
                </p>
                <p className="mt-1 text-sm font-semibold text-violet-200">
                  {lookupResult.loyaltyPoints.toLocaleString("en-US")}
                </p>
              </div>

              <div className="rounded-lg border border-fuchsia-300/[0.09] bg-fuchsia-400/[0.03] px-2.5 py-2">
                <p className="text-[7px] uppercase tracking-[0.11em] text-fuchsia-300/70">
                  Store credit
                </p>
                <p className="mt-1 text-sm font-semibold text-fuchsia-200">
                  {currency(lookupResult.storeCredit)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[7px] leading-4 text-slate-700">
            Prepared for future loyalty points, customer history, and store
            credit balances.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <Input
          value={customerName}
          onChange={setCustomerName}
          placeholder="Customer name"
        />
        <Input
          value={customerContact}
          onChange={setCustomerContact}
          placeholder="Phone or email"
        />
        <Input
          value={employeeName}
          onChange={setEmployeeName}
          placeholder="Staff member"
        />
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Collection notes..."
          className="min-h-[88px] w-full resize-none rounded-xl border border-white/[0.065] bg-white/[0.02] px-3 py-3 text-[10px] text-slate-300 outline-none placeholder:text-slate-700"
        />
      </div>
    </section>
  );
}

function CollectionTable({
  cards,
  settings,
  search,
  setSearch,
  highValueOnly,
  setHighValueOnly,
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  onUpdate,
  onRemove,
  onChangePrinting,
  onPreview,
}: {
  cards: AppraisalCard[];
  settings: BuyingSettings;
  search: string;
  setSearch: (value: string) => void;
  highValueOnly: boolean;
  setHighValueOnly: (value: boolean) => void;
  page: number;
  setPage: (value: number) => void;
  rowsPerPage: number;
  setRowsPerPage: (value: number) => void;
  onUpdate: (rowId: string, patch: Partial<AppraisalCard>) => void;
  onRemove: (rowId: string) => void;
  onChangePrinting: (item: AppraisalCard) => void;
  onPreview: (preview: PreviewState) => void;
}) {
  const filteredCards = cards.filter((item) => {
    const matchesSearch = `${item.card?.name ?? item.name} ${
      item.card?.set_name ?? item.setCode ?? ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesValue =
      !highValueOnly || item.adjustedUnitValue >= 25;

    return matchesSearch && matchesValue;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCards.length / rowsPerPage),
  );
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * rowsPerPage;
  const visibleCards = filteredCards.slice(
    pageStart,
    pageStart + rowsPerPage,
  );

  return (
    <section className={`${styles.glassPanel} min-w-0 rounded-[26px] p-5`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Collection Breakdown
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Priced inventory
          </h2>
          <p className="mt-1 max-w-xl text-[9px] leading-4 text-slate-600">
            The card is the focal point. Staff can verify the printing, adjust only the essential details, and see a simple market-versus-offer comparison.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[8px] text-slate-600">
            {filteredCards.length.toLocaleString("en-US")} lines
          </span>
          <label className="relative">
            <select
              value={rowsPerPage}
              onChange={(event) =>
                setRowsPerPage(Number(event.target.value))
              }
              className="h-9 appearance-none rounded-xl border border-white/[0.065] bg-[#07141e] pl-3 pr-8 text-[8px] text-slate-500 outline-none"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-700" />
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 lg:flex-row">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.065] bg-white/[0.02] px-3">
          <Search className="h-3.5 w-3.5 text-slate-700" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this collection..."
            className="min-w-0 flex-1 bg-transparent text-[9px] text-slate-300 outline-none placeholder:text-slate-700"
          />
        </label>

        <button
          type="button"
          onClick={() => setHighValueOnly(!highValueOnly)}
          className={[
            "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-[8px] font-semibold",
            highValueOnly
              ? "border-amber-300/[0.16] bg-amber-400/[0.05] text-amber-200"
              : "border-white/[0.065] bg-white/[0.02] text-slate-600",
          ].join(" ")}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Show $25+ only
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {visibleCards.map((item) => (
          <InventoryCardRow
            key={item.rowId}
            item={item}
            settings={settings}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onChangePrinting={onChangePrinting}
            onPreview={onPreview}
          />
        ))}
      </div>

      {!cards.length ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.012] px-4 py-16 text-center">
          <ShoppingCart className="mx-auto h-6 w-6 text-slate-800" />
          <p className="mt-3 text-xs font-semibold text-slate-500">
            No collection priced yet
          </p>
          <p className="mt-1 text-[9px] text-slate-700">
            Enter cards manually or import a CSV.
          </p>
        </div>
      ) : null}

      {cards.length && !filteredCards.length ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.07] py-10 text-center text-[9px] text-slate-600">
          No collection rows match the current filters.
        </div>
      ) : null}

      {filteredCards.length > rowsPerPage ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.055] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[8px] text-slate-700">
            Showing {pageStart + 1}–
            {Math.min(pageStart + rowsPerPage, filteredCards.length)} of{" "}
            {filteredCards.length}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(Math.max(1, safePage - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.065] bg-white/[0.02] text-slate-500 disabled:opacity-35"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <span className="min-w-[84px] text-center text-[8px] text-slate-500">
              Page {safePage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.065] bg-white/[0.02] text-slate-500 disabled:opacity-35"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InventoryCardRow({
  item,
  settings,
  onUpdate,
  onRemove,
  onChangePrinting,
  onPreview,
}: {
  item: AppraisalCard;
  settings: BuyingSettings;
  onUpdate: (rowId: string, patch: Partial<AppraisalCard>) => void;
  onRemove: (rowId: string) => void;
  onChangePrinting: (item: AppraisalCard) => void;
  onPreview: (preview: PreviewState) => void;
}) {
  const economics =
    item.status === "ready"
      ? estimateCardEconomics(item, settings)
      : null;

  const storeCredit = economics
    ? economics.offer * (1 + settings.storeCreditBonusPercent / 100)
    : 0;

  return (
    <article className="relative overflow-visible rounded-2xl border border-white/[0.06] bg-black/[0.085] p-4 transition hover:border-cyan-300/[0.12]">
      <div className="inventory-card-layout grid min-w-0 gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onRemove(item.rowId)}
            title="Remove this card"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-300/[0.1] bg-red-400/[0.025] text-red-300/60 transition hover:border-red-300/[0.25] hover:bg-red-400/[0.08] hover:text-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onMouseEnter={(event) =>
              onPreview({
                item,
                anchor: event.currentTarget.getBoundingClientRect(),
              })
            }
            onMouseLeave={() => onPreview(null)}
            onFocus={(event) =>
              onPreview({
                item,
                anchor: event.currentTarget.getBoundingClientRect(),
              })
            }
            onBlur={() => onPreview(null)}
            className="shrink-0"
            aria-label={`Preview ${item.card?.name ?? item.name}`}
          >
            {cardImage(item.card) ? (
              <img
                src={cardImage(item.card)}
                alt={item.card?.name ?? item.name}
                className="h-[92px] w-[66px] cursor-zoom-in rounded-xl object-cover ring-1 ring-white/[0.08] shadow-[0_14px_35px_rgba(0,0,0,0.35)] transition hover:scale-[1.03] hover:ring-cyan-300/35"
              />
            ) : (
              <span className="flex h-[92px] w-[66px] items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
                {item.status === "loading" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                )}
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {item.card?.name ?? item.name}
            </p>

            <p className="mt-1 truncate text-[8px] text-slate-600">
              {item.card
                ? `${item.card.set_name} · ${item.card.set.toUpperCase()} #${item.card.collector_number}`
                : item.error ?? "Looking up card..."}
            </p>

            <div className="relative z-20 mt-3 min-w-0">
              <FieldLabel>Exact printing</FieldLabel>
              {item.card ? (
                <button
                  type="button"
                  onClick={() => onChangePrinting(item)}
                  className="flex min-h-10 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.065] bg-[#07141e] px-3 py-2 text-left transition hover:border-cyan-300/[0.18]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[9px] font-semibold text-slate-300">
                      {item.card.set.toUpperCase()} #{item.card.collector_number}
                    </span>
                    <span className="mt-0.5 block truncate text-[7px] text-slate-700">
                      {item.card.set_name}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg border border-cyan-300/[0.11] bg-cyan-400/[0.035] px-2 py-1 text-[7px] font-semibold text-cyan-200">
                    Change printing
                  </span>
                </button>
              ) : (
                <div className="flex h-10 items-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 text-[8px] text-slate-700">
                  Printing unavailable
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.card?.reserved ? (
                <span className="rounded-md border border-amber-300/[0.12] bg-amber-400/[0.04] px-2 py-1 text-[7px] text-amber-300">
                  Reserved List
                </span>
              ) : null}
              {item.card?.rarity ? (
                <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[7px] capitalize text-slate-600">
                  {item.card.rarity}
                </span>
              ) : null}
              {item.card?.edhrec_rank ? (
                <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[7px] text-slate-600">
                  EDHREC #{item.card.edhrec_rank.toLocaleString("en-US")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3">
          <div>
            <FieldLabel>Quantity</FieldLabel>
            <LargeNumber
              value={item.quantity}
              min={1}
              onChange={(quantity) =>
                onUpdate(item.rowId, { quantity })
              }
            />
          </div>

          <div>
            <FieldLabel>Already owned</FieldLabel>
            <LargeNumber
              value={item.ownedQuantity}
              min={0}
              onChange={(ownedQuantity) =>
                onUpdate(item.rowId, { ownedQuantity })
              }
            />
          </div>

          <div>
            <FieldLabel>Finish</FieldLabel>
            <LargeSelect
              value={item.finish}
              onChange={(value) =>
                onUpdate(item.rowId, {
                  finish: value as PriceFinish,
                  unitMarket:
                    value === "foil"
                      ? Number(item.card?.prices.usd_foil ?? 0)
                      : value === "etched"
                        ? Number(item.card?.prices.usd_etched ?? 0)
                        : Number(item.card?.prices.usd ?? 0),
                })
              }
              options={[
                ["nonfoil", "Nonfoil"],
                ["foil", "Foil"],
                ["etched", "Etched"],
              ]}
            />
          </div>

          <div>
            <FieldLabel>Condition</FieldLabel>
            <LargeSelect
              value={item.condition}
              onChange={(value) =>
                onUpdate(item.rowId, {
                  condition: value as Condition,
                })
              }
              options={[
                ["NM", "Near Mint"],
                ["LP", "Lightly Played"],
                ["MP", "Moderately Played"],
                ["HP", "Heavily Played"],
                ["DMG", "Damaged"],
              ]}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-2">
          <PriceSummaryBox
            label="Market value"
            value={currency(item.lineMarketValue)}
            tone="market"
          />
          <PriceSummaryBox
            label="Cash offer"
            value={economics ? currency(economics.offer) : "—"}
            tone="cash"
          />
          <PriceSummaryBox
            label="Store credit"
            value={economics ? currency(storeCredit) : "—"}
            tone="credit"
          />
        </div>
      </div>
    </article>
  );
}

function PriceSummaryBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "market" | "cash" | "credit";
}) {
  const toneClasses = {
    market:
      "border-sky-300/[0.22] bg-sky-400/[0.045] text-sky-300",
    cash:
      "border-emerald-300/[0.24] bg-emerald-400/[0.055] text-emerald-300",
    credit:
      "border-fuchsia-300/[0.24] bg-fuchsia-400/[0.055] text-fuchsia-300",
  }[tone];

  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${toneClasses}`}>
      <p className="truncate text-[7px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-semibold">{value}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.12em] text-slate-700">
      {children}
    </span>
  );
}

function LargeNumber({
  value,
  min,
  onChange,
}: {
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      value={value}
      onChange={(event) =>
        onChange(Math.max(min, Number(event.target.value) || min))
      }
      className="h-10 w-full rounded-xl border border-white/[0.065] bg-white/[0.02] px-3 text-[9px] text-slate-300 outline-none focus:border-cyan-300/[0.18]"
    />
  );
}

function LargeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="relative block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-white/[0.065] bg-[#07141e] pl-3 pr-8 text-[8px] text-slate-400 outline-none focus:border-cyan-300/[0.18]"
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-700" />
    </label>
  );
}

function PrintableCustomerOffer({
  cards,
  settings,
  customerName,
  employeeName,
  totals,
}: {
  cards: AppraisalCard[];
  settings: BuyingSettings;
  customerName: string;
  employeeName: string;
  totals: ReturnType<typeof emptyTotalsShape>;
}) {
  return (
    <section className="print-offer hidden">
      <header className="print-header">
        <div>
          <h1>Trading Docks</h1>
          <p>Collection Purchase Offer</p>
        </div>
        <div className="print-meta">
          <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
          <p><strong>Customer:</strong> {customerName || "Walk-in Customer"}</p>
          {employeeName ? <p><strong>Prepared by:</strong> {employeeName}</p> : null}
        </div>
      </header>

      <table className="print-table">
        <thead>
          <tr>
            <th>Card</th>
            <th>Printing</th>
            <th>Condition</th>
            <th>Qty</th>
            <th>Offer</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((item) => {
            const economics = estimateCardEconomics(item, settings);
            return (
              <tr key={item.rowId}>
                <td>{item.card?.name ?? item.name}</td>
                <td>
                  {item.card
                    ? `${item.card.set.toUpperCase()} #${item.card.collector_number}`
                    : item.setCode?.toUpperCase() ?? ""}
                </td>
                <td>{item.condition} · {capitalize(item.finish)}</td>
                <td>{item.quantity}</td>
                <td>{currency(economics.offer)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="print-totals">
        <div>
          <span>Cash purchase offer</span>
          <strong>{currency(totals.cashOffer)}</strong>
        </div>
        <div>
          <span>Store credit alternative</span>
          <strong>{currency(totals.storeCreditOffer)}</strong>
        </div>
      </div>

      <div className="print-terms">
        <p>
          This offer is subject to final verification of card identity,
          authenticity, quantity, and physical condition. Prices may change
          until the transaction is completed.
        </p>
        <div className="print-signatures">
          <span>Customer signature</span>
          <span>Employee signature</span>
        </div>
      </div>
    </section>
  );
}

function OfferSummary({
  totals,
  settings,
  appraisalStatus,
  setAppraisalStatus,
  onSave,
  onPurchase,
}: {
  totals: ReturnType<typeof emptyTotalsShape>;
  settings: BuyingSettings;
  appraisalStatus: SavedAppraisal["status"];
  setAppraisalStatus: (value: SavedAppraisal["status"]) => void;
  onSave: (status: SavedAppraisal["status"]) => void;
  onPurchase: () => void;
}) {
  return (
    <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
        Customer Offer
      </p>
      <p className="mt-4 text-[9px] text-slate-600">
        Recommended cash offer
      </p>
      <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
        {currency(totals.cashOffer)}
      </p>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.03] px-3 py-2.5">
        <span className="text-[8px] text-slate-600">
          Blended collection offer
        </span>
        <span className="text-sm font-semibold text-cyan-200">
          {totals.averageOfferPercent.toFixed(1)}%
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-violet-300/[0.1] bg-violet-400/[0.035] p-4">
        <p className="text-[8px] uppercase tracking-[0.14em] text-violet-300">
          Store credit alternative
        </p>
        <p className="mt-2 text-xl font-semibold text-violet-100">
          {currency(totals.storeCreditOffer)}
        </p>
        <p className="mt-1 text-[8px] text-slate-600">
          Includes {settings.storeCreditBonusPercent}% bonus
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {(["offered", "accepted", "declined", "draft"] as const).map(
          (status) => (
            <button
              key={status}
              type="button"
              onClick={() => setAppraisalStatus(status)}
              className={[
                "h-9 rounded-xl border text-[8px] font-semibold capitalize",
                appraisalStatus === status
                  ? "border-cyan-300/[0.17] bg-cyan-400/[0.05] text-cyan-200"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-600",
              ].join(" ")}
            >
              {status}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={() => onSave(appraisalStatus)}
        className="mt-3 h-10 w-full rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 text-[9px] font-semibold text-[#001018]"
      >
        Save {appraisalStatus} appraisal
      </button>
      <button
        type="button"
        onClick={onPurchase}
        className="mt-2 h-10 w-full rounded-xl border border-emerald-300/[0.18] bg-emerald-400/[0.06] text-[9px] font-semibold text-emerald-200 hover:bg-emerald-400/[0.1]"
      >
        Purchase and send to intake
      </button>
    </section>
  );
}

function RiskPanel({
  profile,
  cards,
}: {
  profile: {
    score: number;
    label: string;
    tone: string;
    reasons: string[];
  };
  cards: AppraisalCard[];
}) {
  return (
    <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            Buying Risk
          </p>
          <p className={`mt-2 text-lg font-semibold ${profile.tone}`}>
            {profile.label}
          </p>
        </div>
        <span className="text-2xl font-semibold text-white">
          {Math.round(profile.score)}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-300 to-emerald-300"
          style={{ width: `${profile.score}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {profile.reasons.map((reason) => (
          <div
            key={reason}
            className="flex items-start gap-2 text-[8px] leading-4 text-slate-600"
          >
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />
            {reason}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[7px] leading-4 text-slate-800">
        Demand is estimated from Scryfall metadata such as EDHREC rank,
        Reserved List status, price tier, and reprint information. It is not a
        guarantee of sell-through.
      </p>
    </section>
  );
}

function ProfitPanel({
  totals,
  settings,
}: {
  totals: ReturnType<typeof emptyTotalsShape>;
  settings: BuyingSettings;
}) {
  const rows = [
    ["Expected sale revenue", totals.market],
    [`Marketplace fees (${settings.feePercent}%)`, -totals.fees],
    ["Estimated shipping", -totals.shipping],
    ["Estimated labor", -totals.labor],
    ["Cash paid to customer", -totals.cashOffer],
  ] as const;

  return (
    <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
        Profit Simulation
      </p>

      <div className="mt-4 space-y-3">
        {rows.map(([label, amount]) => (
          <div
            key={label}
            className="flex items-center justify-between text-[9px]"
          >
            <span className="text-slate-600">{label}</span>
            <span
              className={
                amount >= 0 ? "text-slate-300" : "text-red-300/80"
              }
            >
              {amount < 0 ? "−" : ""}
              {currency(Math.abs(amount))}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-300">
            Projected profit
          </span>
          <span className="text-lg font-semibold text-emerald-300">
            {currency(totals.projectedProfit)}
          </span>
        </div>
        <p className="mt-1 text-right text-[8px] text-slate-700">
          {totals.projectedMargin.toFixed(1)}% projected net margin
        </p>
      </div>
    </section>
  );
}

function BuyingIntelligence({
  cards,
  settings,
}: {
  cards: AppraisalCard[];
  settings: BuyingSettings;
}) {
  const recommendations = useMemo(() => {
    const output: Array<{
      title: string;
      detail: string;
      icon: typeof Sparkles;
      tone: string;
    }> = [];

    const overstocked = cards.filter((card) => card.ownedQuantity >= 10);
    const highDemand = cards.filter(
      (card) => (card.card?.edhrec_rank ?? 999999) <= 1000,
    );
    const lowValue = cards.filter((card) => card.adjustedUnitValue < 1);
    const highEnd = cards.filter((card) => card.adjustedUnitValue >= 100);
    const reserved = cards.filter((card) => card.card?.reserved);

    if (highDemand.length) {
      output.push({
        title: "Strong liquidity detected",
        detail: `${highDemand.length} line${highDemand.length === 1 ? "" : "s"} rank within the top 1,000 EDHREC cards. A balanced or aggressive offer may be reasonable.`,
        icon: TrendingUp,
        tone: "text-emerald-300",
      });
    }

    if (overstocked.length) {
      output.push({
        title: "Existing inventory exposure",
        detail: `${overstocked.length} line${overstocked.length === 1 ? "" : "s"} have 10 or more copies already owned. Consider reducing those line offers.`,
        icon: AlertTriangle,
        tone: "text-amber-300",
      });
    }

    if (lowValue.length) {
      output.push({
        title: "Labor-heavy inventory",
        detail: `${lowValue.length} line${lowValue.length === 1 ? "" : "s"} are under $1 after condition adjustment. These may cost more to process than they generate.`,
        icon: ClipboardCheck,
        tone: "text-amber-300",
      });
    }

    if (highEnd.length) {
      output.push({
        title: "High-value verification",
        detail: `${highEnd.length} card line${highEnd.length === 1 ? "" : "s"} exceed $100 each. Require condition review and authentication before final payment.`,
        icon: ShieldCheck,
        tone: "text-cyan-300",
      });
    }

    if (reserved.length) {
      output.push({
        title: "Reserved List value",
        detail: `${reserved.length} line${reserved.length === 1 ? "" : "s"} are Reserved List cards and may justify a stronger offer after authentication.`,
        icon: Store,
        tone: "text-violet-300",
      });
    }

    if (!output.length) {
      output.push({
        title: "Balanced collection",
        detail:
          "No major concentration warnings were detected. Review physical condition before making the final offer.",
        icon: Sparkles,
        tone: "text-cyan-300",
      });
    }

    return output.slice(0, 6);
  }, [cards, settings]);

  return (
    <section className={`${styles.glassPanel} print-hide mt-5 rounded-[26px] p-5`}>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-violet-300">
          Buying Intelligence
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          Collection-level recommendations
        </h2>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {recommendations.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4"
            >
              <Icon className={`h-4 w-4 ${item.tone}`} />
              <p className="mt-3 text-xs font-semibold text-slate-200">
                {item.title}
              </p>
              <p className="mt-2 text-[9px] leading-4 text-slate-600">
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SettingsModal({
  open,
  settings,
  setSettings,
  onClose,
}: {
  open: boolean;
  settings: BuyingSettings;
  setSettings: React.Dispatch<React.SetStateAction<BuyingSettings>>;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <ModalFrame onClose={onClose} maxWidth="max-w-[760px]">
      <ModalHeader
        eyebrow="Profit Protection"
        title="Collection buying rules"
        onClose={onClose}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <SettingSelect
          label="Offer strategy"
          value={settings.offerMode}
          options={[
            ["safe", "Safe"],
            ["balanced", "Balanced"],
            ["aggressive", "Aggressive"],
            ["custom", "Custom percentage"],
          ]}
          onChange={(offerMode) =>
            setSettings((current) => ({
              ...current,
              offerMode: offerMode as OfferMode,
            }))
          }
        />

        <SettingNumber
          label="Custom offer %"
          value={settings.customOfferPercent}
          suffix="%"
          disabled={settings.offerMode !== "custom"}
          onChange={(customOfferPercent) =>
            setSettings((current) => ({
              ...current,
              customOfferPercent,
            }))
          }
        />

        <SettingNumber
          label="Marketplace fee"
          value={settings.feePercent}
          suffix="%"
          onChange={(feePercent) =>
            setSettings((current) => ({ ...current, feePercent }))
          }
        />

        <SettingNumber
          label="Shipping per order"
          value={settings.shippingPerOrder}
          prefix="$"
          step={0.01}
          onChange={(shippingPerOrder) =>
            setSettings((current) => ({
              ...current,
              shippingPerOrder,
            }))
          }
        />

        <SettingNumber
          label="Average cards per order"
          value={settings.averageCardsPerOrder}
          step={0.1}
          onChange={(averageCardsPerOrder) =>
            setSettings((current) => ({
              ...current,
              averageCardsPerOrder,
            }))
          }
        />

        <SettingNumber
          label="Labor per card"
          value={settings.laborPerCard}
          prefix="$"
          step={0.01}
          onChange={(laborPerCard) =>
            setSettings((current) => ({ ...current, laborPerCard }))
          }
        />

        <SettingNumber
          label="Target margin"
          value={settings.targetMarginPercent}
          suffix="%"
          onChange={(targetMarginPercent) =>
            setSettings((current) => ({
              ...current,
              targetMarginPercent,
            }))
          }
        />

        <SettingNumber
          label="Cash offer adjustment"
          value={settings.cashAdjustmentPercent}
          suffix="%"
          onChange={(cashAdjustmentPercent) =>
            setSettings((current) => ({
              ...current,
              cashAdjustmentPercent,
            }))
          }
        />

        <SettingNumber
          label="Store credit bonus"
          value={settings.storeCreditBonusPercent}
          suffix="%"
          onChange={(storeCreditBonusPercent) =>
            setSettings((current) => ({
              ...current,
              storeCreditBonusPercent,
            }))
          }
        />

        <SettingNumber
          label="Minimum priced card"
          value={settings.minimumPricedCard}
          prefix="$"
          step={0.01}
          onChange={(minimumPricedCard) =>
            setSettings((current) => ({
              ...current,
              minimumPricedCard,
            }))
          }
        />
      </div>

      <div className="mt-6 rounded-xl border border-amber-300/[0.1] bg-amber-400/[0.03] p-4 text-[8px] leading-4 text-slate-600">
        The suggested percentages are internal decision-support estimates.
        Final offers should account for physical condition, authenticity,
        current store inventory, local demand, taxes, and marketplace rules.
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-5 h-10 w-full rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 text-[9px] font-semibold text-[#001018]"
      >
        Apply buying rules
      </button>
    </ModalFrame>
  );
}

function HistoryModal({
  open,
  appraisals,
  onClose,
  onLoad,
  onDelete,
}: {
  open: boolean;
  appraisals: SavedAppraisal[];
  onClose: () => void;
  onLoad: (appraisal: SavedAppraisal) => void;
  onDelete: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <ModalFrame onClose={onClose} maxWidth="max-w-[860px]">
      <ModalHeader
        eyebrow="Buying History"
        title="Saved collection appraisals"
        onClose={onClose}
      />

      <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto">
        {appraisals.map((appraisal) => {
          const market = appraisal.cards.reduce(
            (sum, item) => sum + item.lineMarketValue,
            0,
          );
          const offer = appraisal.cards.reduce(
            (sum, item) =>
              sum +
              estimateCardEconomics(item, appraisal.settings).offer,
            0,
          );

          return (
            <div
              key={appraisal.id}
              className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-black/[0.09] p-4 sm:flex-row sm:items-center"
            >
              <button
                type="button"
                onClick={() => onLoad(appraisal)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-slate-200">
                    {appraisal.customerName}
                  </p>
                  <span className="rounded-md border border-white/[0.06] bg-white/[0.025] px-1.5 py-0.5 text-[7px] capitalize text-slate-600">
                    {appraisal.status}
                  </span>
                </div>
                <p className="mt-1 text-[8px] text-slate-700">
                  {new Date(appraisal.createdAt).toLocaleString()} ·{" "}
                  {appraisal.cards.length} lines
                </p>
                <p className="mt-2 text-[9px] text-slate-500">
                  Market {currency(market)} · Offer {currency(offer)}
                </p>
              </button>

              <button
                type="button"
                onClick={() => onDelete(appraisal.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-slate-700 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {!appraisals.length ? (
          <div className="rounded-2xl border border-dashed border-white/[0.07] py-14 text-center">
            <History className="mx-auto h-5 w-5 text-slate-800" />
            <p className="mt-3 text-xs text-slate-600">
              No saved appraisals yet
            </p>
          </div>
        ) : null}
      </div>
    </ModalFrame>
  );
}

function SessionPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[7px] uppercase tracking-[0.11em] text-slate-700">
        {label}
      </p>
      <p className="mt-1 text-[9px] font-semibold text-slate-300">
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.065] bg-white/[0.02] px-3 text-[8px] font-semibold text-slate-500 transition hover:border-cyan-300/[0.12] hover:text-cyan-200"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-white/[0.065] bg-white/[0.02] px-3 text-[10px] text-slate-300 outline-none placeholder:text-slate-700"
    />
  );
}

function SettingNumber({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-700">
        {label}
      </span>
      <span className="flex h-10 items-center rounded-xl border border-white/[0.065] bg-white/[0.02] px-3">
        {prefix ? (
          <span className="mr-1 text-[9px] text-slate-700">{prefix}</span>
        ) : null}
        <input
          type="number"
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-300 outline-none disabled:opacity-40"
        />
        {suffix ? (
          <span className="ml-1 text-[9px] text-slate-700">{suffix}</span>
        ) : null}
      </span>
    </label>
  );
}

function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-white/[0.065] bg-[#07141e] px-3 text-[10px] text-slate-400 outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModalFrame({
  children,
  onClose,
  maxWidth,
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth: string;
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label="Close"
      />
      <div
        className={`relative z-10 max-h-[92vh] w-full ${maxWidth} overflow-y-auto rounded-[28px] border border-cyan-300/[0.13] bg-[#06131d]/98 p-5 shadow-[0_38px_120px_rgba(0,0,0,0.58)] sm:p-6`}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.17em] text-cyan-300">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function exportCsv(
  cards: AppraisalCard[],
  settings: BuyingSettings,
  customerName: string,
  cashOffer: number,
) {
  const header = [
    "Card",
    "Set",
    "Collector Number",
    "Quantity",
    "Finish",
    "Condition",
    "Unit Market",
    "Adjusted Market",
    "Suggested Percent",
    "Final Offer",
  ];

  const rows = cards.map((item) => {
    const economics =
      item.status === "ready"
        ? estimateCardEconomics(item, settings)
        : null;

    return [
      item.card?.name ?? item.name,
      item.card?.set.toUpperCase() ?? item.setCode ?? "",
      item.card?.collector_number ?? item.collectorNumber ?? "",
      item.quantity,
      item.finish,
      item.condition,
      item.unitMarket.toFixed(2),
      item.lineMarketValue.toFixed(2),
      item.suggestedPercent.toFixed(2),
      economics?.offer.toFixed(2) ?? "0.00",
    ];
  });

  rows.push([
    "TOTAL OFFER",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    cashOffer.toFixed(2),
  ]);

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\\n");

  downloadFile(
    csv,
    `${slug(customerName || "walk-in")}-collection-appraisal.csv`,
    "text/csv;charset=utf-8",
  );
}

function exportJson(payload: unknown) {
  downloadFile(
    JSON.stringify(payload, null, 2),
    "collection-appraisal.json",
    "application/json",
  );
}

function downloadFile(
  contents: string,
  filename: string,
  type: string,
) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function emptyTotalsShape() {
  return {
    market: 0,
    cashOffer: 0,
    storeCreditOffer: 0,
    fees: 0,
    shipping: 0,
    labor: 0,
    projectedNet: 0,
    projectedProfit: 0,
    averageOfferPercent: 0,
    projectedMargin: 0,
    units: 0,
  };
}
