"use client";

import {
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  CircleUserRound,
  Cloud,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Moon,
  Paintbrush,
  PlugZap,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { saveSettings } from "@/app/actions/settings";
import { RevenueCatBillingManagementButton } from "@/components/billing/RevenueCatBillingManagementButton";
import type { AccountTier } from "@/lib/plan-entitlements";

type SettingsData = Record<string, string | boolean | number>;
type SectionId =
  | "overview"
  | "account"
  | "workspace"
  | "billing"
  | "integrations"
  | "inventory"
  | "csv"
  | "selling"
  | "storage"
  | "notifications"
  | "team"
  | "security"
  | "data"
  | "appearance";

type NavItem = {
  id: SectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  storeOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", description: "Workspace health", icon: LayoutDashboard },
  { id: "account", label: "Account", description: "Profile and contact", icon: CircleUserRound },
  { id: "workspace", label: "Workspace", description: "Business identity", icon: Building2 },
  { id: "billing", label: "Billing", description: "Plan and invoices", icon: CreditCard },
  { id: "integrations", label: "Integrations", description: "Connected channels", icon: PlugZap },
  { id: "inventory", label: "Inventory", description: "Card defaults", icon: Boxes },
  { id: "csv", label: "CSV & Imports", description: "Conversion rules", icon: FileSpreadsheet },
  { id: "selling", label: "Selling", description: "Listing defaults", icon: ShoppingBag },
  { id: "storage", label: "Storage", description: "Locations and labels", icon: Database },
  { id: "notifications", label: "Notifications", description: "Alerts and delivery", icon: Bell },
  { id: "team", label: "Team", description: "People and permissions", icon: UsersRound, storeOnly: true },
  { id: "security", label: "Security", description: "Sessions and protection", icon: ShieldCheck },
  { id: "data", label: "Data & Privacy", description: "Backups and deletion", icon: Cloud },
  { id: "appearance", label: "Appearance", description: "Display preferences", icon: Paintbrush },
];

const DEFAULTS: SettingsData = {
  fullName: "",
  phone: "",
  timezone: "America/Phoenix",
  currency: "USD",
  businessName: "",
  website: "",
  storeAddress: "",
  defaultGame: "Magic: The Gathering",
  condition: "Near Mint",
  language: "English",
  finish: "Non-foil",
  priceSource: "TCGplayer Market",
  storageLocation: "Unsorted Inventory",
  duplicateHandling: "Combine quantities",
  lowStock: 1,
  csvInput: "Automatic detection",
  csvOutput: "Trading Docks Universal",
  csvReview: true,
  scryfallVerify: true,
  csvSaveInventory: false,
  marketplace: "TCGplayer",
  pricingRule: "Market price",
  minimumPrice: 1.99,
  handlingTime: "1 business day",
  markListed: true,
  overselling: true,
  salesAlerts: true,
  priceAlerts: true,
  syncAlerts: true,
  taskAlerts: true,
  emailAlerts: true,
  browserAlerts: true,
  theme: "Dark",
  density: "Comfortable",
  cardSize: "Medium",
  largerText: false,
  reducedMotion: false,
};

function isSectionId(value: string): value is SectionId {
  return NAV_ITEMS.some((item) => item.id === value);
}

export function SettingsCenter({
  initialSection,
  initialSettings,
  email,
  plan,
  planName,
  subscription,
}: {
  initialSection: string;
  initialSettings: Record<string, unknown>;
  email: string;
  plan: AccountTier;
  planName: string;
  subscription: {
    status: string;
    billingCycle: string;
    renewalDate: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}) {
  const [active, setActive] = useState<SectionId>(
    isSectionId(initialSection) ? initialSection : "overview",
  );
  const [settings, setSettings] = useState<SettingsData>(() => {
    const savedSettings: SettingsData = {};
    for (const [key, value] of Object.entries(initialSettings)) {
      if (
        typeof value === "string" ||
        typeof value === "boolean" ||
        typeof value === "number"
      ) {
        savedSettings[key] = value;
      }
    }
    return { ...DEFAULTS, ...savedSettings };
  });
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const visibleNav = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return NAV_ITEMS;
    return NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized),
    );
  }, [query]);

  function update(key: string, value: string | boolean | number) {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function persist() {
    setError("");
    startTransition(async () => {
      try {
        await saveSettings(settings);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2600);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Settings could not be saved.");
      }
    });
  }

  const activeItem = NAV_ITEMS.find((item) => item.id === active) ?? NAV_ITEMS[0];

  return (
    <div className="mt-4 grid overflow-hidden rounded-[28px] border border-td-ink/[0.08] bg-td-surface/95 shadow-[0_28px_90px_rgb(var(--td-shadow-rgb)/calc(0.28*var(--td-shadow-strength)))] sm:mt-7 xl:min-h-[760px] xl:grid-cols-[286px_minmax(0,1fr)]">
      <aside className="border-b border-td-ink/[0.07] bg-td-surface/90 p-3 sm:p-4 xl:border-b-0 xl:border-r">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-td-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a setting"
            className="h-11 w-full rounded-xl border border-td-ink/[0.07] bg-black/15 pl-10 pr-3 text-sm text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/30"
          />
        </div>
        <div className="relative mt-3 sm:hidden">
          <select
            value={active}
            onChange={(event) => setActive(event.target.value as SectionId)}
            aria-label="Choose a settings section"
            className="h-12 w-full appearance-none rounded-xl border border-td-accent/[0.16] bg-td-accent/[0.07] px-4 pr-10 text-sm font-semibold text-td-primary outline-none focus:border-td-accent/40"
          >
            {visibleNav.map((item) => (
              <option key={item.id} value={item.id} className="bg-td-surface text-td-primary">
                {item.label} — {item.description}
              </option>
            ))}
          </select>
          <ChevronRight className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-td-accent-text" />
          <p className="mt-2 px-1 text-[11px] text-td-muted">
            All settings sections are available from this menu.
          </p>
        </div>
        <nav className="mt-4 hidden grid-cols-3 gap-2 sm:grid lg:grid-cols-4 xl:grid-cols-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const locked = item.storeOnly && plan !== "store";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={`group flex min-h-14 items-center gap-2.5 rounded-xl px-3 text-left transition ${
                  active === item.id
                    ? "border border-td-accent/[0.16] bg-td-accent/[0.08] text-td-primary"
                    : "border border-transparent text-td-secondary hover:bg-td-ink/[0.035] hover:text-td-primary"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active === item.id ? "bg-td-accent/10 text-td-accent-text" : "bg-td-ink/[0.035] text-td-muted"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    {item.label}
                    {locked ? <LockKeyhole className="h-3 w-3 text-td-warning" /> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-td-muted sm:text-[11px]">{item.description}</span>
                </span>
                <ChevronRight className="hidden h-3.5 w-3.5 text-td-muted xl:block" />
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 p-4 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-4 border-b border-td-ink/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-td-accent-text/80">Settings / {activeItem.label}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-td-primary">{activeItem.label}</h2>
            <p className="mt-1 text-sm text-td-muted">{activeItem.description}</p>
          </div>
          {active !== "overview" && active !== "billing" && active !== "integrations" && active !== "team" && active !== "data" ? (
            <button
              type="button"
              onClick={persist}
              disabled={pending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-semibold text-td-on-accent transition hover:brightness-110 disabled:opacity-60"
            >
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {pending ? "Saving…" : saved ? "Saved" : "Save changes"}
            </button>
          ) : null}
        </div>
        {error ? <div className="mt-5 rounded-xl border border-td-danger/20 bg-td-danger/[0.07] px-4 py-3 text-xs text-td-danger">{error}</div> : null}

        <div className="mt-5 sm:mt-7">
          {active === "overview" && <Overview planName={planName} subscription={subscription} onOpen={setActive} />}
          {active === "account" && <AccountSettings settings={settings} email={email} update={update} />}
          {active === "workspace" && <WorkspaceSettings settings={settings} update={update} />}
          {active === "billing" && <BillingSettings planName={planName} subscription={subscription} />}
          {active === "integrations" && <Integrations />}
          {active === "inventory" && <InventorySettings settings={settings} update={update} />}
          {active === "csv" && <CsvSettings settings={settings} update={update} />}
          {active === "selling" && <SellingSettings settings={settings} update={update} />}
          {active === "storage" && <StorageSettings settings={settings} update={update} />}
          {active === "notifications" && <NotificationSettings settings={settings} update={update} />}
          {active === "team" && <TeamSettings locked={plan !== "store"} />}
          {active === "security" && <SecuritySettings />}
          {active === "data" && <DataSettings email={email} />}
          {active === "appearance" && <AppearanceSettings settings={settings} update={update} />}
        </div>
      </main>
    </div>
  );
}

function Overview({ planName, subscription, onOpen }: { planName: string; subscription: { renewalDate: string | null } | null; onOpen: (id: SectionId) => void }) {
  const cards = [
    { label: "Membership", value: planName, detail: subscription?.renewalDate ? `Renews ${subscription.renewalDate}` : "Core access active", icon: CreditCard, color: "cyan", target: "billing" as const },
    { label: "Connections", value: "0 connected", detail: "Connect your selling channels", icon: Link2, color: "violet", target: "integrations" as const },
    { label: "Inventory defaults", value: "Configured", detail: "Review condition and pricing", icon: Boxes, color: "emerald", target: "inventory" as const },
    { label: "Security", value: "Standard", detail: "Add two-step verification", icon: ShieldCheck, color: "amber", target: "security" as const },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button key={card.label} type="button" onClick={() => onOpen(card.target)} className="rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-td-accent/[0.18] hover:bg-td-ink/[0.04]">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-td-accent/[0.07] text-td-accent-text"><Icon className="h-4 w-4" /></span>
                <ChevronRight className="h-4 w-4 text-td-muted" />
              </div>
              <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-td-muted">{card.label}</div>
              <div className="mt-1 text-lg font-semibold text-td-primary">{card.value}</div>
              <div className="mt-1 text-xs text-td-muted">{card.detail}</div>
            </button>
          );
        })}
      </div>
      <Panel title="Finish setting up Trading Docks" description="These steps unlock the most useful seller and store workflows.">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Connect a marketplace", "Keep listing and sync status in one place", "integrations"],
            ["Choose inventory defaults", "Speed up imports and collection intake", "inventory"],
            ["Set CSV conversion rules", "Make every conversion consistent", "csv"],
          ].map(([title, detail, target], index) => (
            <button key={title} type="button" onClick={() => onOpen(target as SectionId)} className="flex gap-3 rounded-xl border border-td-ink/[0.06] bg-black/10 p-4 text-left transition hover:border-td-accent/20">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-td-accent/10 text-xs font-semibold text-td-accent-text">{index + 1}</span>
              <span><span className="block text-xs font-semibold text-td-primary">{title}</span><span className="mt-1 block text-[11px] leading-5 text-td-muted">{detail}</span></span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AccountSettings({ settings, email, update }: SettingsProps & { email: string }) {
  return <FormGrid>
    <Field label="Full name"><Input value={settings.fullName as string} onChange={(v) => update("fullName", v)} placeholder="Your name" /></Field>
    <Field label="Email address" hint="Managed by your sign-in provider"><Input value={email} disabled /></Field>
    <Field label="Phone number"><Input value={settings.phone as string} onChange={(v) => update("phone", v)} placeholder="Optional" /></Field>
    <Field label="Time zone"><Select value={settings.timezone as string} onChange={(v) => update("timezone", v)} options={["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York"]} /></Field>
    <Field label="Currency"><Select value={settings.currency as string} onChange={(v) => update("currency", v)} options={["USD", "CAD", "EUR", "GBP", "AUD"]} /></Field>
  </FormGrid>;
}

function WorkspaceSettings({ settings, update }: SettingsProps) {
  return <FormGrid>
    <Field label="Business or store name" hint="Used in your Mission Control greeting"><Input value={settings.businessName as string} onChange={(v) => update("businessName", v)} placeholder="Example: Desert Mana Games" /></Field>
    <Field label="Website"><Input value={settings.website as string} onChange={(v) => update("website", v)} placeholder="https://" /></Field>
    <Field label="Store address" wide><Input value={settings.storeAddress as string} onChange={(v) => update("storeAddress", v)} placeholder="Used for invoices and local operations" /></Field>
    <Field label="Business logo" wide><UploadPlaceholder /></Field>
  </FormGrid>;
}

function BillingSettings({ planName, subscription }: { planName: string; subscription: { status: string; billingCycle: string; renewalDate: string | null; cancelAtPeriodEnd: boolean } | null }) {
  return <div className="space-y-5">
    <div className="relative overflow-hidden rounded-2xl border border-td-accent/[0.15] bg-gradient-to-br from-td-accent/[0.09] via-td-surface to-td-surface p-6">
      <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-td-accent/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">Current membership</div><h3 className="mt-2 text-3xl font-semibold text-td-primary">{planName}</h3><p className="mt-2 text-sm text-td-secondary">{subscription ? `${subscription.status} · ${subscription.billingCycle} billing${subscription.renewalDate ? ` · ${subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} ${subscription.renewalDate}` : ""}` : "No paid subscription is connected."}</p></div>
        {subscription ? <RevenueCatBillingManagementButton /> : <a href="/dashboard/plans" className="inline-flex h-11 items-center justify-center rounded-xl bg-td-accent px-5 text-sm font-semibold text-td-on-accent">Compare plans</a>}
      </div>
    </div>
    <Panel title="Billing controls" description="Securely managed through RevenueCat.">
      <div className="grid gap-3 sm:grid-cols-3">{["Payment methods", "Invoices & receipts", "Change or cancel plan"].map((item) => <div key={item} className="rounded-xl border border-td-ink/[0.06] bg-black/10 p-4 text-xs font-medium text-td-secondary">{item}</div>)}</div>
    </Panel>
  </div>;
}

function Integrations() {
  const connections = [
    ["TCGplayer", "Listings, inventory and sales files", "Seller"],
    ["eBay", "Listings, orders and fulfillment", "Seller"],
    ["Mana Pool", "Inventory and marketplace activity", "Seller"],
    ["Shopify", "Products, inventory and orders", "Store"],
    ["Discord", "Community and tournament alerts", "All plans"],
    ["Scryfall", "Card identity and printing verification", "Connected"],
  ];
  return <div className="grid gap-4 md:grid-cols-2">
    {connections.map(([name, detail, tier]) => <div key={name} className="flex items-center gap-4 rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-td-ink/[0.06] bg-black/15 text-td-accent-text"><Globe2 className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-td-primary">{name}<span className="rounded-full bg-td-ink/[0.05] px-2 py-0.5 text-[11px] font-medium text-td-muted">{tier}</span></span><span className="mt-1 block text-[11px] text-td-muted">{detail}</span></span>
      <button type="button" className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tier === "Connected" ? "bg-td-success/10 text-td-success" : "border border-td-ink/[0.08] text-td-secondary hover:border-td-accent/25"}`}>{tier === "Connected" ? "Active" : "Connect"}</button>
    </div>)}
  </div>;
}

function InventorySettings({ settings, update }: SettingsProps) {
  return <FormGrid>
    <Field label="Default card game"><Select value={settings.defaultGame as string} onChange={(v) => update("defaultGame", v)} options={["Magic: The Gathering", "Pokémon", "Disney Lorcana", "Yu-Gi-Oh!", "One Piece"]} /></Field>
    <Field label="Preferred price source"><Select value={settings.priceSource as string} onChange={(v) => update("priceSource", v)} options={["TCGplayer Market", "TCGplayer Low", "Scryfall USD", "Card Kingdom"]} /></Field>
    <Field label="Default condition"><Select value={settings.condition as string} onChange={(v) => update("condition", v)} options={["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"]} /></Field>
    <Field label="Default language"><Select value={settings.language as string} onChange={(v) => update("language", v)} options={["English", "Japanese", "Spanish", "French", "German", "Italian"]} /></Field>
    <Field label="Default finish"><Select value={settings.finish as string} onChange={(v) => update("finish", v)} options={["Non-foil", "Foil", "Etched"]} /></Field>
    <Field label="Default storage location"><Input value={settings.storageLocation as string} onChange={(v) => update("storageLocation", v)} /></Field>
    <Field label="Duplicate handling"><Select value={settings.duplicateHandling as string} onChange={(v) => update("duplicateHandling", v)} options={["Combine quantities", "Keep separate rows", "Ask every time"]} /></Field>
    <Field label="Low-stock threshold"><NumberInput value={settings.lowStock as number} onChange={(v) => update("lowStock", v)} /></Field>
  </FormGrid>;
}

function CsvSettings({ settings, update }: SettingsProps) {
  return <div className="space-y-5"><FormGrid>
    <Field label="Preferred input format"><Select value={settings.csvInput as string} onChange={(v) => update("csvInput", v)} options={["Automatic detection", "ManaBox", "TCGplayer", "Moxfield", "Dragon Shield", "Trading Docks Universal"]} /></Field>
    <Field label="Preferred output format"><Select value={settings.csvOutput as string} onChange={(v) => update("csvOutput", v)} options={["Trading Docks Universal", "TCGplayer", "ManaBox", "Moxfield", "Card Kingdom", "Deckbox"]} /></Field>
  </FormGrid><Panel title="Conversion safeguards" description="Applied to every file processed in the CSV Conversion Engine.">
    <ToggleList items={[
      ["Require manual review before export", "Prevent unresolved rows from becoming marketplace files", "csvReview"],
      ["Verify printings with Scryfall", "Use IDs, set codes and collector numbers to confirm matches", "scryfallVerify"],
      ["Save converted cards to inventory", "Choose or create a storage location after conversion", "csvSaveInventory"],
    ]} settings={settings} update={update} />
  </Panel></div>;
}

function SellingSettings({ settings, update }: SettingsProps) {
  return <div className="space-y-5"><FormGrid>
    <Field label="Default marketplace"><Select value={settings.marketplace as string} onChange={(v) => update("marketplace", v)} options={["TCGplayer", "eBay", "Mana Pool", "Trading Docks", "In-Store"]} /></Field>
    <Field label="Pricing rule"><Select value={settings.pricingRule as string} onChange={(v) => update("pricingRule", v)} options={["Market price", "Lowest listed", "Market minus 5%", "Custom price"]} /></Field>
    <Field label="Minimum listing price"><NumberInput value={settings.minimumPrice as number} step={0.01} onChange={(v) => update("minimumPrice", v)} /></Field>
    <Field label="Handling time"><Select value={settings.handlingTime as string} onChange={(v) => update("handlingTime", v)} options={["Same business day", "1 business day", "2 business days", "3 business days"]} /></Field>
  </FormGrid><Panel title="Listing protection"><ToggleList items={[
    ["Automatically mark exports as listed", "Allocate exported inventory to the selected marketplace", "markListed"],
    ["Overselling protection", "Warn or block listings that exceed available quantity", "overselling"],
  ]} settings={settings} update={update} /></Panel></div>;
}

function StorageSettings({ settings, update }: SettingsProps) {
  return <div className="space-y-5">
    <Panel title="Default intake location" description="New cards will begin here unless you choose another location."><Field label="Location"><Input value={settings.storageLocation as string} onChange={(v) => update("storageLocation", v)} /></Field></Panel>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{["Bulk Box 001", "Trade Binder", "Unsorted Inventory"].map((name, index) => <div key={name} className="rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-4"><div className="flex items-center justify-between"><Database className="h-4 w-4 text-td-accent-text" /><span className="text-[11px] uppercase tracking-[0.15em] text-td-muted">{index === 2 ? "Default" : "Active"}</span></div><div className="mt-4 text-sm font-semibold text-td-primary">{name}</div><div className="mt-1 text-[11px] text-td-muted">Ready for inventory</div></div>)}</div>
    <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-accent/20 bg-td-accent/[0.05] px-4 text-xs font-semibold text-td-accent-text">+ Create storage location</button>
  </div>;
}

function NotificationSettings({ settings, update }: SettingsProps) {
  return <div className="space-y-5"><Panel title="Alert types"><ToggleList items={[
    ["Sales and order alerts", "New orders, cancellations and fulfillment updates", "salesAlerts"],
    ["Price-change alerts", "Meaningful movement on watched inventory", "priceAlerts"],
    ["Failed synchronization alerts", "Marketplace or import actions that need attention", "syncAlerts"],
    ["Task and tournament reminders", "Upcoming work and event notifications", "taskAlerts"],
  ]} settings={settings} update={update} /></Panel><Panel title="Delivery channels"><ToggleList items={[
    ["Email", "Send important alerts to your account email", "emailAlerts"],
    ["Browser and in-app", "Show notifications while using Trading Docks", "browserAlerts"],
  ]} settings={settings} update={update} /></Panel></div>;
}

function TeamSettings({ locked }: { locked: boolean }) {
  if (locked) return <LockedFeature title="Team management is included with Store" detail="Invite employees, assign operational roles, protect financial information, and review team activity." />;
  return <div className="space-y-5"><Panel title="Team members" description="Invite people and control what each role can access."><div className="flex items-center justify-between rounded-xl border border-td-ink/[0.06] bg-black/10 p-4"><div><div className="text-sm font-semibold text-td-primary">You</div><div className="mt-1 text-[11px] text-td-muted">Owner · Full access</div></div><span className="rounded-full bg-td-accent/10 px-3 py-1 text-[11px] font-semibold text-td-accent-text">Owner</span></div></Panel><button type="button" className="inline-flex h-10 items-center rounded-xl bg-td-accent px-4 text-xs font-semibold text-td-on-accent">Invite team member</button></div>;
}

function SecuritySettings() {
  return <div className="space-y-4">{[
    ["Two-factor authentication", "Add an extra verification step when signing in", "Set up"],
    ["Active sessions", "Review devices currently signed into this account", "Review"],
    ["Password", "Update your password through your sign-in provider", "Change"],
    ["Connected applications", "Review services that can access Trading Docks", "Review"],
  ].map(([title, detail, action]) => <div key={title} className="flex flex-col gap-4 rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-5 sm:flex-row sm:items-center"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-td-success/[0.07] text-td-success"><KeyRound className="h-4 w-4" /></span><span className="flex-1"><span className="block text-sm font-semibold text-td-primary">{title}</span><span className="mt-1 block text-[11px] text-td-muted">{detail}</span></span><button type="button" className="h-9 rounded-lg border border-td-ink/[0.08] px-3 text-[11px] font-semibold text-td-secondary">{action}</button></div>)}</div>;
}

function DataSettings({ email }: { email: string }) {
  const deletionRequestHref = accountDeletionRequestHref(email);

  return (
    <div className="space-y-5">
      <Panel title="Your data" description="Download a portable copy or create a safety backup.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionCard
            icon={Download}
            title="Export account data"
            detail="Support can prepare an account export during beta."
            status="Support-assisted"
          />
          <ActionCard
            icon={FileSpreadsheet}
            title="Download inventory backup"
            detail="Use CSV Conversion for inventory files while full export is prepared."
            status="Use CSV tools"
            href="/dashboard/tools/csv-converter"
          />
        </div>
      </Panel>
      <div className="rounded-2xl border border-td-danger/[0.14] bg-td-danger/[0.035] p-5">
        <div className="text-sm font-semibold text-td-danger">Danger zone</div>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-td-muted">
          Account deletion is support-assisted during beta so identity, workspace ownership, billing, and legally
          retained records can be reviewed before removal.
        </p>
        <a
          href={deletionRequestHref}
          className="mt-4 inline-flex h-9 items-center rounded-lg border border-td-danger/20 px-3 text-[11px] font-semibold text-td-danger transition hover:border-td-danger/35 hover:bg-td-danger/[0.06]"
        >
          Request account deletion
        </a>
      </div>
    </div>
  );
}

function accountDeletionRequestHref(email: string) {
  const subject = encodeURIComponent("Trading Docks account deletion request");
  const body = encodeURIComponent(`Please help me delete my Trading Docks account.\n\nAccount email: ${email}`);
  return `mailto:tradingdocks@gmail.com?subject=${subject}&body=${body}`;
}

function AppearanceSettings({ settings, update }: SettingsProps) {
  return <FormGrid>
    <Field label="Theme"><Select value={settings.theme as string} onChange={(v) => update("theme", v)} options={["Dark", "Light", "System"]} /></Field>
    <Field label="Layout density"><Select value={settings.density as string} onChange={(v) => update("density", v)} options={["Comfortable", "Compact"]} /></Field>
    <Field label="Card grid size"><Select value={settings.cardSize as string} onChange={(v) => update("cardSize", v)} options={["Small", "Medium", "Large"]} /></Field>
    <Field label="Accessibility" wide><div className="space-y-3"><InlineToggle label="Larger interface text" checked={settings.largerText as boolean} onChange={(v) => update("largerText", v)} /><InlineToggle label="Reduce interface motion" checked={settings.reducedMotion as boolean} onChange={(v) => update("reducedMotion", v)} /></div></Field>
  </FormGrid>;
}

type SettingsProps = { settings: SettingsData; update: (key: string, value: string | boolean | number) => void };

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-5"><div className="mb-5"><h3 className="text-sm font-semibold text-td-primary">{title}</h3>{description ? <p className="mt-1 text-[11px] leading-5 text-td-muted">{description}</p> : null}</div>{children}</section>;
}
function FormGrid({ children }: { children: React.ReactNode }) { return <div className="grid gap-5 md:grid-cols-2">{children}</div>; }
function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "md:col-span-2" : ""}><span className="mb-2 flex items-center justify-between text-[11px] font-semibold text-td-secondary"><span>{label}</span>{hint ? <span className="font-normal text-td-muted">{hint}</span> : null}</span>{children}</label>; }
function Input({ value, onChange, placeholder, disabled }: { value: string; onChange?: (value: string) => void; placeholder?: string; disabled?: boolean }) { return <input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled} className="h-11 w-full rounded-xl border border-td-ink/[0.08] bg-black/15 px-3.5 text-sm text-td-primary outline-none transition placeholder:text-td-muted focus:border-td-accent/30 disabled:cursor-not-allowed disabled:text-td-muted" />; }
function NumberInput({ value, onChange, step = 1 }: { value: number; onChange: (value: number) => void; step?: number }) { return <input type="number" min="0" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full rounded-xl border border-td-ink/[0.08] bg-black/15 px-3.5 text-sm text-td-primary outline-none focus:border-td-accent/30" />; }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-td-ink/[0.08] bg-td-surface px-3.5 text-sm text-td-primary outline-none focus:border-td-accent/30">{options.map((option) => <option key={option}>{option}</option>)}</select>; }
function InlineToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between rounded-xl border border-td-ink/[0.07] bg-black/10 px-4 py-3 text-left text-xs text-td-secondary"><span>{label}</span><span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-td-accent" : "bg-td-surface"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} /></span></button>; }
function ToggleList({ items, settings, update }: { items: string[][] } & SettingsProps) { return <div className="divide-y divide-td-ink/[0.06]">{items.map(([title, detail, key]) => <div key={key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-td-primary">{title}</span><span className="mt-1 block text-[11px] leading-5 text-td-muted">{detail}</span></span><InlineToggle label="" checked={settings[key] as boolean} onChange={(v) => update(key, v)} /></div>)}</div>; }
function UploadPlaceholder() { return <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-dashed border-td-ink/[0.12] bg-black/10 p-4 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-td-ink/[0.04] text-td-muted"><Store className="h-4 w-4" /></span><span><span className="block text-xs font-semibold text-td-secondary">Upload your logo</span><span className="mt-1 block text-[11px] text-td-muted">PNG, JPG or WebP · Recommended 512 × 512</span></span></button>; }
function LockedFeature({ title, detail }: { title: string; detail: string }) { return <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-td-warning/[0.13] bg-td-warning/[0.025] p-8 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-td-warning/[0.08] text-td-warning"><LockKeyhole className="h-6 w-6" /></span><h3 className="mt-5 text-lg font-semibold text-td-primary">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-td-muted">{detail}</p><a href="/dashboard/plans" className="mt-6 inline-flex h-10 items-center rounded-xl bg-td-warning px-4 text-xs font-semibold text-td-on-accent">View Store plan</a></div>; }
function ActionCard({
  icon: Icon,
  title,
  detail,
  status,
  href,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  status?: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-td-accent/[0.07] text-td-accent-text">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-td-primary">{title}</span>
        <span className="mt-1 block text-[11px] leading-4 text-td-muted">{detail}</span>
      </span>
      {status ? (
        <span className="rounded-full border border-td-ink/[0.08] bg-td-ink/[0.035] px-2 py-1 text-[11px] font-semibold text-td-secondary">
          {status}
        </span>
      ) : null}
    </>
  );
  const className = "flex items-center gap-3 rounded-xl border border-td-ink/[0.06] bg-black/10 p-4 text-left";

  return href ? (
    <a href={href} className={`${className} transition hover:border-td-accent/20 hover:bg-td-accent/[0.035]`}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}
