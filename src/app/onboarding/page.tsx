"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  Database,
  Gem,
  Layers3,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Warehouse,
} from "lucide-react";

import { TradingDocksMark } from "@/components/brand/trading-docks-logo";
import { completeOnboarding } from "@/app/actions/workspace";

type AccountType =
  | "collector"
  | "seller"
  | "store"
  | "large-seller";

type InventoryModule =
  | "singles"
  | "sealed"
  | "graded"
  | "binders"
  | "bulk"
  | "supplies";

type AccountOption = {
  id: AccountType;
  title: string;
  description: string;
  icon: ReactNode;
  dashboardTitle: string;
  dashboardDescription: string;
  dashboardIcon: ReactNode;
  modules: string[];
};

type InventoryOption = {
  id: InventoryModule;
  title: string;
  description: string;
  icon: ReactNode;
};

const accountOptions: AccountOption[] = [
  {
    id: "collector",
    title: "Collector",
    description:
      "Organize personal collections, binders, decks, graded cards, and sealed holdings.",
    icon: <Gem className="h-4 w-4" />,
    dashboardTitle: "Collection Overview",
    dashboardDescription:
      "Track collection value, binders, decks, wishlists, graded cards, and set completion.",
    dashboardIcon: <Gem className="h-4 w-4" />,
    modules: [
      "Binder Manager",
      "Set Completion",
      "Deck Builder",
      "Wishlist",
      "Collection Search",
      "Graded Cards",
    ],
  },
  {
    id: "seller",
    title: "Online seller",
    description:
      "Manage inventory, pricing, marketplace listings, orders, and sales activity.",
    icon: <ShoppingBag className="h-4 w-4" />,
    dashboardTitle: "Seller Overview",
    dashboardDescription:
      "Monitor inventory, listings, orders, pricing, margins, and marketplace performance.",
    dashboardIcon: <ShoppingBag className="h-4 w-4" />,
    modules: [
      "Marketplace Sync",
      "Pricing Engine",
      "Inventory Management",
      "Order Tracking",
      "Profit Analytics",
      "Listing Tools",
    ],
  },
  {
    id: "store",
    title: "Local game store",
    description:
      "Track store inventory, sealed products, supplies, orders, and business operations.",
    icon: <Store className="h-4 w-4" />,
    dashboardTitle: "Inventory Overview",
    dashboardDescription:
      "Manage singles, sealed products, bulk intake, listings, and store analytics.",
    dashboardIcon: <Store className="h-4 w-4" />,
    modules: [
      "Singles Inventory",
      "Sealed Inventory",
      "Bulk Intake",
      "Binder Tracking",
      "Marketplace Listings",
      "Store Analytics",
    ],
  },
  {
    id: "large-seller",
    title: "Large-volume seller",
    description:
      "Operate high-volume inventory, warehouse storage, sorting, and marketplace workflows.",
    icon: <Building2 className="h-4 w-4" />,
    dashboardTitle: "Business Overview",
    dashboardDescription:
      "Manage warehouse inventory, batch imports, orders, pricing, and business performance.",
    dashboardIcon: <Warehouse className="h-4 w-4" />,
    modules: [
      "Warehouse Inventory",
      "Batch Imports",
      "Marketplace Sync",
      "Pricing Engine",
      "Order Queue",
      "Business Analytics",
    ],
  },
];

const inventoryOptions: InventoryOption[] = [
  {
    id: "singles",
    title: "Singles",
    description:
      "Individual cards across sets, conditions, languages, and printings.",
    icon: <Layers3 className="h-4 w-4" />,
  },
  {
    id: "sealed",
    title: "Sealed products",
    description:
      "Boxes, cases, bundles, decks, packs, displays, and sealed collections.",
    icon: <Package className="h-4 w-4" />,
  },
  {
    id: "graded",
    title: "Graded cards",
    description:
      "PSA, BGS, CGC, SGC, certification, purchase cost, and value tracking.",
    icon: <Gem className="h-4 w-4" />,
  },
  {
    id: "binders",
    title: "Binders and storage",
    description:
      "Binders, pages, boxes, shelves, vaults, and custom inventory locations.",
    icon: <Database className="h-4 w-4" />,
  },
  {
    id: "bulk",
    title: "Bulk inventory",
    description:
      "Commons, uncommons, rares, lots, boxes, and unsorted inventory intake.",
    icon: <Warehouse className="h-4 w-4" />,
  },
  {
    id: "supplies",
    title: "Supplies and accessories",
    description:
      "Sleeves, deck boxes, binders, loaders, playmats, and shipping materials.",
    icon: <Boxes className="h-4 w-4" />,
  },
];

function AccountTypeCard({
  option,
  selected,
  previewed,
  onSelect,
  onPreview,
}: {
  option: AccountOption;
  selected: boolean;
  previewed: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onPreview}
      onFocus={onPreview}
      aria-pressed={selected}
      className={`group relative min-h-[128px] rounded-2xl border p-4 text-left transition-all duration-300 ease-out ${
        selected
          ? "-translate-y-[3px] border-td-accent/70 bg-td-accent/[0.09] shadow-[0_0_0_1px_rgb(var(--td-accent-rgb)/0.16),0_18px_46px_rgb(var(--td-shadow-rgb)/calc(0.30*var(--td-shadow-strength))),0_0_42px_rgb(var(--td-accent-rgb)/0.18)]"
          : previewed
            ? "-translate-y-0.5 border-td-accent/35 bg-td-accent/[0.05]"
            : "border-td-ink/10 bg-td-ink/[0.03] hover:-translate-y-0.5 hover:border-td-accent/30 hover:bg-td-accent/[0.045]"
      }`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-td-accent/[0.08] via-transparent to-transparent transition-opacity duration-300 ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-70"
        }`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 ${
            selected
              ? "border-td-accent/45 bg-td-accent/15 text-td-accent-text shadow-[0_0_24px_rgb(var(--td-accent-rgb)/0.24)]"
              : "border-td-ink/10 bg-td-ink/[0.04] text-td-secondary group-hover:border-td-accent/25 group-hover:text-td-accent-text"
          }`}
        >
          {option.icon}
        </div>

        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-300 ${
            selected
              ? "scale-100 border-td-accent/80 bg-td-accent text-td-on-accent opacity-100 shadow-[0_0_18px_rgb(var(--td-accent-rgb)/0.35)]"
              : "scale-90 border-td-ink/25 bg-td-ink/[0.025] text-transparent opacity-80"
          }`}
        >
          <Check
            className={`h-3 w-3 transition-all duration-300 ${
              selected
                ? "scale-100 opacity-100"
                : "scale-75 opacity-0"
            }`}
          />
        </div>
      </div>

      <div className="relative mt-4">
        <h3 className="text-sm font-semibold text-td-primary">
          {option.title}
        </h3>

        <p className="mt-1.5 max-w-[94%] text-[11px] leading-[1.55] text-td-secondary">
          {option.description}
        </p>
      </div>
    </button>
  );
}

function InventoryModuleCard({
  option,
  selected,
  onToggle,
}: {
  option: InventoryOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`group relative flex min-h-[100px] items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300 ${
        selected
          ? "-translate-y-0.5 border-td-accent/55 bg-td-accent/[0.08] shadow-[0_0_30px_rgb(var(--td-accent-rgb)/0.10)]"
          : "border-td-ink/10 bg-td-ink/[0.025] hover:-translate-y-0.5 hover:border-td-accent/25 hover:bg-td-accent/[0.04]"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
          selected
            ? "border-td-accent/30 bg-td-accent/15 text-td-accent-text shadow-[0_0_18px_rgb(var(--td-accent-rgb)/0.12)]"
            : "border-td-ink/[0.07] bg-td-ink/[0.04] text-td-muted group-hover:text-td-accent-text"
        }`}
      >
        {option.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-td-primary">
            {option.title}
          </h3>

          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
              selected
                ? "border-td-accent/60 bg-td-accent text-td-on-accent"
                : "border-td-ink/25 bg-td-ink/[0.025] text-transparent"
            }`}
          >
            <Check
              className={`h-3 w-3 transition-all duration-300 ${
                selected
                  ? "scale-100 opacity-100"
                  : "scale-75 opacity-0"
              }`}
            />
          </div>
        </div>

        <p className="mt-1.5 text-[11px] leading-4 text-td-secondary">
          {option.description}
        </p>
      </div>
    </button>
  );
}

function WorkspacePreview({
  option,
}: {
  option: AccountOption;
}) {
  return (
    <div
      key={option.id}
      className="workspace-preview mt-4 overflow-hidden rounded-2xl border border-td-accent/15 bg-gradient-to-br from-td-accent/[0.055] via-white/[0.025] to-transparent p-4 shadow-[0_18px_50px_rgb(var(--td-shadow-rgb)/calc(0.22*var(--td-shadow-strength))),0_0_30px_rgb(var(--td-accent-rgb)/0.05)]"
    >
      <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_300px] xl:items-stretch">
        <div className="flex items-center gap-3 border-b border-td-ink/[0.07] pb-4 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-td-accent/35 bg-td-accent/12 text-td-accent-text shadow-[0_0_24px_rgb(var(--td-accent-rgb)/0.14)]">
            {option.dashboardIcon}
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-td-muted">
              Workspace preview
            </p>

            <h3 className="mt-1 text-sm font-semibold text-td-primary">
              {option.title}
            </h3>

            <p className="mt-1 text-[11px] text-td-muted">
              Dashboard modules enabled
            </p>
          </div>
        </div>

        <div className="grid auto-rows-fr gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {option.modules.map((module) => (
            <div
              key={module}
              className="preview-module flex min-h-[56px] h-full items-center gap-2.5 rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] px-3 py-2.5"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-td-accent/40 bg-td-accent/10 text-td-accent-text">
                <Check className="h-3.5 w-3.5" />
              </div>

              <span className="text-[11px] font-medium leading-4 text-td-primary">
                {module}
              </span>
            </div>
          ))}
        </div>

        <div className="flex h-full min-h-[120px] items-center gap-3 rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-td-accent/10 text-td-accent-text">
            <BarChart3 className="h-4 w-4" />
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-td-muted">
              Primary dashboard
            </p>

            <p className="mt-1 text-xs font-semibold text-td-primary">
              {option.dashboardTitle}
            </p>

            <p className="mt-1 text-[11px] leading-4 text-td-muted">
              {option.dashboardDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] =
    useState<AccountType | null>(null);

  const [previewedAccountType, setPreviewedAccountType] =
    useState<AccountType>("collector");

  const [modules, setModules] = useState<InventoryModule[]>([
    "singles",
    "binders",
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const progress = useMemo(() => {
    if (step === 1) {
      return "33%";
    }

    if (step === 2) {
      return "66%";
    }

    return "100%";
  }, [step]);

  const selectedAccount = accountOptions.find(
    (option) => option.id === accountType,
  );

  const previewAccount =
    selectedAccount ??
    accountOptions.find(
      (option) => option.id === previewedAccountType,
    ) ??
    accountOptions[0];

  const selectedModules = inventoryOptions.filter((option) =>
    modules.includes(option.id),
  );

  const continueDisabled =
    (step === 1 && !accountType) ||
    (step === 2 && modules.length === 0);

  function selectAccount(type: AccountType) {
    setAccountType(type);
    setPreviewedAccountType(type);
  }

  function toggleModule(module: InventoryModule) {
    setModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module],
    );
  }

  function continueToNextStep() {
    if (continueDisabled) {
      return;
    }

    if (step < 3) {
      setStep((current) => current + 1);
    }
  }

  async function finishOnboarding() {
    if (!accountType || modules.length === 0 || saving) return;

    setSaving(true);
    setSaveError("");

    try {
      await completeOnboarding({ accountType, modules });
    } catch (error) {
      setSaving(false);
      setSaveError(
        error instanceof Error
          ? error.message
          : "We could not save your workspace. Please try again.",
      );
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-td-canvas text-td-primary lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <style>{`
        @keyframes ambientGlow {
          0%, 100% {
            opacity: 0.52;
            transform: translate3d(0, 0, 0) scale(1);
          }

          50% {
            opacity: 0.95;
            transform: translate3d(18px, -12px, 0) scale(1.08);
          }
        }

        @keyframes panelFloat {
          0%, 100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes sweep {
          0% {
            transform: translateX(-170%) skewX(-18deg);
          }

          68%, 100% {
            transform: translateX(420%) skewX(-18deg);
          }
        }

        @keyframes selectedPulse {
          0%, 100% {
            opacity: 0.72;
            filter: drop-shadow(
              0 0 7px rgb(var(--td-accent-rgb)/0.16)
            );
          }

          50% {
            opacity: 1;
            filter: drop-shadow(
              0 0 13px rgb(var(--td-accent-rgb)/0.24)
            );
          }
        }

        @keyframes previewEnter {
          0% {
            opacity: 0;
            transform: translateY(7px) scale(0.992);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes moduleEnter {
          0% {
            opacity: 0;
            transform: translateX(-5px);
          }

          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes buttonActivate {
          0% {
            box-shadow: 0 0 0 rgb(var(--td-accent-rgb)/0);
          }

          50% {
            box-shadow: 0 0 34px rgb(var(--td-accent-rgb)/0.3);
          }

          100% {
            box-shadow: 0 12px 32px rgb(var(--td-accent-rgb)/0.28);
          }
        }

        .ambient-glow {
          animation: ambientGlow 10s ease-in-out infinite;
        }

        .panel-float {
          animation: panelFloat 7.5s ease-in-out infinite;
        }

        .panel-sweep {
          animation: sweep 8s ease-in-out infinite;
        }

        .selected-pulse {
          animation: selectedPulse 3.5s ease-in-out infinite;
        }

        .workspace-preview {
          animation: previewEnter 320ms ease-out;
        }

        .preview-module {
          animation: moduleEnter 360ms ease-out both;
        }

        .preview-module:nth-child(2) {
          animation-delay: 35ms;
        }

        .preview-module:nth-child(3) {
          animation-delay: 70ms;
        }

        .preview-module:nth-child(4) {
          animation-delay: 105ms;
        }

        .preview-module:nth-child(5) {
          animation-delay: 140ms;
        }

        .preview-module:nth-child(6) {
          animation-delay: 175ms;
        }

        .continue-active {
          animation: buttonActivate 440ms ease-out;
        }

        @media (min-width: 1024px) {
          .onboarding-scale {
            transform: translateY(-10px);
            transform-origin: center;
          }
        }

        @media (max-height: 820px) and (min-width: 1024px) {
          .onboarding-scale {
            transform: translateY(-8px) scale(0.94);
          }
        }

        @media (max-height: 740px) and (min-width: 1024px) {
          .onboarding-scale {
            transform: translateY(-6px) scale(0.88);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ambient-glow,
          .panel-float,
          .panel-sweep,
          .selected-pulse,
          .workspace-preview,
          .preview-module,
          .continue-active {
            animation: none !important;
          }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.1]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--td-accent-rgb)/0.14) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--td-accent-rgb)/0.14) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
        }}
      />

      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none fixed -left-56 -top-56 h-[760px] w-[760px] rounded-full bg-td-accent/[0.14] blur-[205px]"
      />

      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none fixed -bottom-72 right-[-150px] h-[760px] w-[760px] rounded-full bg-td-accent/[0.09] blur-[220px]"
        style={{ animationDelay: "-4s" }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-[20%] h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-td-accent/[0.045] blur-[145px]"
      />

      <header className="relative z-20 border-b border-td-ink/[0.07] bg-td-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <TradingDocksMark className="h-7 w-7" />

            <div>
              <p className="text-xs font-semibold text-td-primary">
                Trading Docks
              </p>

              <p className="text-[11px] text-td-muted">
                Workspace setup
              </p>
            </div>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-td-ink/10 bg-td-ink/[0.035] px-3 py-1.5 text-[11px] text-td-secondary">
            <ShieldCheck className="h-3 w-3 text-td-accent-text" />
            Secure onboarding
          </div>
        </div>
      </header>

      <div className="onboarding-scale relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1360px] flex-col justify-center px-5 py-3 sm:px-8 lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:px-8 lg:py-1">
        <div className="mx-auto max-w-[780px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-td-accent/25 bg-td-accent/[0.07] px-3 py-1.5 text-[11px] font-medium text-td-accent-text shadow-[0_0_28px_rgb(var(--td-accent-rgb)/0.08)]">
            <Sparkles className="h-3 w-3" />
            Step {step} of 3
          </div>

          <h1 className="mt-3 text-[clamp(2rem,4.2vw,3.45rem)] font-semibold leading-[0.96] tracking-[-0.055em] text-td-primary">
            {step === 1 && "Tell us how you use Trading Docks."}
            {step === 2 && "Choose what you want to manage."}
            {step === 3 && "Your workspace is ready."}
          </h1>

          <p className="mx-auto mt-3 max-w-[670px] text-xs leading-5 text-td-secondary lg:text-sm">
            {step === 1 &&
              "We’ll personalize your dashboard, shortcuts, and recommended tools around your collection or business."}

            {step === 2 &&
              "Select every inventory category you currently manage. You can change these choices later."}

            {step === 3 &&
              "Review your selections and continue into your personalized Trading Docks dashboard."}
          </p>
        </div>

        <div className="mx-auto mt-4 w-full max-w-[1080px]">
          <div className="mb-3 flex items-center justify-between text-[11px] text-td-muted">
            <span>Account type</span>
            <span>Inventory modules</span>
            <span>Complete</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-td-ink/[0.05]">
            <div
              className="selected-pulse h-full rounded-full bg-gradient-to-r from-td-accent via-td-accent to-td-accent shadow-[0_0_16px_rgb(var(--td-accent-rgb)/0.30)] transition-all duration-500"
              style={{ width: progress }}
            />
          </div>
        </div>

        <div className="panel-float relative mx-auto mt-4 w-full max-w-[1220px]">
          <div
            aria-hidden="true"
            className="ambient-glow pointer-events-none absolute -inset-16 rounded-[72px] bg-td-accent/[0.14] blur-[115px]"
          />

          <div className="relative overflow-hidden rounded-[30px] border border-td-accent/30 bg-td-ink/[0.045] p-1.5 shadow-[0_38px_120px_rgb(var(--td-shadow-rgb)/calc(0.58*var(--td-shadow-strength))),0_0_78px_rgb(var(--td-accent-rgb)/0.15)] backdrop-blur-2xl">
            <div className="panel-sweep pointer-events-none absolute inset-y-0 left-0 z-20 w-24 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

            <div className="relative rounded-[24px] border border-td-ink/[0.09] bg-td-surface/96 p-5 sm:p-6">
              {step === 1 ? (
                <>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <p className="text-[11px] font-medium text-td-primary">
                      Choose the workspace that best matches your business.
                    </p>

                    <span className="hidden text-[11px] text-td-muted sm:inline">
                      One selection required
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {accountOptions.map((option) => (
                      <AccountTypeCard
                        key={option.id}
                        option={option}
                        selected={accountType === option.id}
                        previewed={
                          previewedAccountType === option.id
                        }
                        onSelect={() => selectAccount(option.id)}
                        onPreview={() =>
                          setPreviewedAccountType(option.id)
                        }
                      />
                    ))}
                  </div>

                  <WorkspacePreview option={previewAccount} />
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <p className="text-[11px] font-medium text-td-primary">
                      Select every inventory category you want enabled.
                    </p>

                    <span className="hidden text-[11px] text-td-muted sm:inline">
                      Choose one or more
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inventoryOptions.map((option) => (
                      <InventoryModuleCard
                        key={option.id}
                        option={option}
                        selected={modules.includes(option.id)}
                        onToggle={() => toggleModule(option.id)}
                      />
                    ))}
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
                  <div className="rounded-2xl border border-td-accent/30 bg-td-accent/[0.07] p-5 shadow-[0_0_38px_rgb(var(--td-accent-rgb)/0.09)]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-td-accent/35 bg-td-accent/12 text-td-accent-text shadow-[0_0_20px_rgb(var(--td-accent-rgb)/0.12)]">
                      {selectedAccount?.icon}
                    </div>

                    <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-td-muted">
                      Workspace profile
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-td-primary">
                      {selectedAccount?.title}
                    </h2>

                    <p className="mt-2 text-xs leading-5 text-td-secondary">
                      Your dashboard will prioritize the tools most useful
                      for this type of account.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-td-ink/10 bg-td-ink/[0.025] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-td-muted">
                          Enabled modules
                        </p>

                        <h2 className="mt-1 text-base font-semibold text-td-primary">
                          {modules.length} selected
                        </h2>
                      </div>

                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-td-success/10 text-td-success">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {selectedModules.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center gap-2.5 rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] px-3 py-2.5"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-td-accent/10 text-td-accent-text">
                            {option.icon}
                          </div>

                          <span className="text-[11px] font-medium text-td-primary">
                            {option.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col-reverse gap-2.5 border-t border-td-ink/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                {step === 1 ? (
                  <Link
                    href="/sign-in"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-td-ink/10 bg-td-ink/[0.025] px-4 text-[11px] font-semibold text-td-secondary transition hover:-translate-y-0.5 hover:border-td-accent/25 hover:text-td-primary"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to sign in
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setStep((current) => current - 1)
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-td-ink/10 bg-td-ink/[0.025] px-4 text-[11px] font-semibold text-td-secondary transition hover:-translate-y-0.5 hover:border-td-accent/25 hover:text-td-primary"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={continueToNextStep}
                    disabled={continueDisabled}
                    className={`group inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-[11px] font-semibold transition focus:outline-none focus:ring-4 focus:ring-td-accent/15 ${
                      continueDisabled
                        ? "cursor-not-allowed border border-td-ink/10 bg-td-surface text-td-muted shadow-none"
                        : "continue-active bg-gradient-to-r from-td-accent via-td-accent to-td-accent text-td-on-accent shadow-[0_12px_32px_rgb(var(--td-accent-rgb)/0.28)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgb(var(--td-accent-rgb)/0.42)]"
                    }`}
                  >
                    Continue

                    <ArrowRight
                      className={`h-3.5 w-3.5 transition-transform ${
                        continueDisabled
                          ? ""
                          : "group-hover:translate-x-1"
                      }`}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={finishOnboarding}
                    disabled={saving}
                    className="group inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-td-accent via-td-accent to-td-accent px-5 text-[11px] font-semibold text-td-on-accent shadow-[0_12px_32px_rgb(var(--td-accent-rgb)/0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgb(var(--td-accent-rgb)/0.42)]"
                  >
                    {saving ? "Saving workspace..." : "Enter dashboard"}

                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                )}
              </div>
              {saveError ? (
                <p className="mt-3 text-right text-[11px] text-td-danger">
                  {saveError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-2.5 text-center text-[11px] text-td-muted">
          You can change your account type and enabled modules later in
          workspace settings.
        </p>
      </div>
    </main>
  );
}
