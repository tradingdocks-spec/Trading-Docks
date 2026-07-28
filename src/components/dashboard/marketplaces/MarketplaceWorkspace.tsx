"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  FileSpreadsheet,
  Inbox,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Upload,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type ConnectionMethod = "api" | "csv" | "email" | "manual";
type ConnectionStatus = "not_configured" | "setup_required" | "ready" | "attention";
type MarketplaceDefinition = {
  id: string;
  name: string;
  games: string;
  description: string;
  methods: ConnectionMethod[];
  recommended: ConnectionMethod;
  setup: string[];
};
type SavedConnection = {
  marketplace_id: string;
  connection_method: ConnectionMethod;
  status: ConnectionStatus;
  settings: Record<string, unknown> | null;
  last_sync_at: string | null;
};
type CsvPreview = {
  name: string;
  rows: number;
  headers: string[];
  kind: "inventory" | "orders" | "unknown";
};

const METHOD_LABELS: Record<ConnectionMethod, string> = {
  api: "Official API",
  csv: "CSV semi-sync",
  email: "Order email tracking",
  manual: "Guided manual tracking",
};

const marketplaces: MarketplaceDefinition[] = [
  {
    id: "tcgplayer",
    name: "TCGplayer",
    games: "Magic · Pokémon · Lorcana · Yu-Gi-Oh!",
    description: "Import seller inventory and orders without storing a TCGplayer password.",
    methods: ["csv", "email", "manual"],
    recommended: "csv",
    setup: [
      "Export inventory or orders from the TCGplayer Seller Portal.",
      "Upload the CSV in Semi-Sync and review every proposed change.",
      "Optionally connect order-email tracking for faster sale notifications.",
      "Use the generated export when Trading Docks needs to send changes back.",
    ],
  },
  {
    id: "ebay",
    name: "eBay",
    games: "All supported collectibles",
    description: "Listings, orders, fulfillment, tracking, and inventory through approved seller APIs.",
    methods: ["api", "csv", "manual"],
    recommended: "api",
    setup: [
      "Create or use an eBay Developers Program application.",
      "Add the Trading Docks OAuth redirect URL to the eBay application.",
      "Authorize the seller account—never enter the eBay password in Trading Docks.",
      "Import listings first, then enable quantity and fulfillment writes.",
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    games: "Storefront catalog",
    description: "Products, inventory levels, online orders, and fulfillment through Shopify Admin.",
    methods: ["api", "csv", "email"],
    recommended: "api",
    setup: [
      "Create a custom app in Shopify Admin.",
      "Grant only product, inventory, order, and fulfillment scopes that are needed.",
      "Install the app and store the token in server-side encrypted credentials.",
      "Run an import-only reconciliation before enabling writes.",
    ],
  },
  {
    id: "mana-pool",
    name: "Mana Pool",
    games: "Magic: The Gathering",
    description: "Listings and sales using approved account access where available.",
    methods: ["api", "csv", "email", "manual"],
    recommended: "api",
    setup: [
      "Add an approved seller token if the account has marketplace API access.",
      "Otherwise use CSV or order-email tracking.",
      "Match Mana Pool listings to Trading Docks inventory before enabling updates.",
    ],
  },
  {
    id: "cardtrader",
    name: "CardTrader",
    games: "Magic · Pokémon · other TCGs",
    description: "International listings, orders, and CardTrader Zero reconciliation.",
    methods: ["api", "csv", "email", "manual"],
    recommended: "api",
    setup: [
      "Request or locate approved API credentials in the seller account.",
      "Begin with listings and order reads.",
      "Enable quantity writes only after inventory reconciliation.",
    ],
  },
  {
    id: "cardsphere",
    name: "CardSphere",
    games: "Magic: The Gathering",
    description: "Track sends, wants, collection availability, and completed activity.",
    methods: ["csv", "email", "manual"],
    recommended: "email",
    setup: [
      "Use an available export when possible.",
      "Connect transaction emails or forward them to the Trading Docks order inbox.",
      "Confirm completed sends before deducting inventory.",
    ],
  },
  {
    id: "whatnot",
    name: "Whatnot",
    games: "Live-selling collectibles",
    description: "Track live-sale orders and reconcile inventory after shows.",
    methods: ["csv", "email", "manual"],
    recommended: "csv",
    setup: [
      "Import the seller order report after each show.",
      "Review unmatched product titles before inventory is deducted.",
      "Use email tracking for individual order notifications when available.",
    ],
  },
  {
    id: "etsy",
    name: "Etsy",
    games: "Collectibles · accessories",
    description: "Listings and orders for eligible products through approved Etsy access.",
    methods: ["api", "csv", "email", "manual"],
    recommended: "api",
    setup: [
      "Register an Etsy developer application.",
      "Authorize the shop using OAuth.",
      "Import listings before enabling updates.",
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    games: "Eligible catalog products",
    description: "Seller Central catalog and order reconciliation when approved.",
    methods: ["api", "csv", "email", "manual"],
    recommended: "csv",
    setup: [
      "Confirm Selling Partner API eligibility before attempting a connection.",
      "Use Seller Central reports while access is pending.",
      "Do not automate login or scrape Seller Central pages.",
    ],
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    games: "Self-hosted storefront",
    description: "Products, stock, orders, and fulfillment through store REST credentials.",
    methods: ["api", "csv", "email"],
    recommended: "api",
    setup: [
      "Create read/write REST credentials for the intended store.",
      "Store credentials only in encrypted server-side storage.",
      "Run a read-only import before enabling stock updates.",
    ],
  },
  {
    id: "facebook",
    name: "Facebook Marketplace",
    games: "Local and shipped collectibles",
    description: "Guided listing records and sale confirmation without unsupported automation.",
    methods: ["email", "manual"],
    recommended: "manual",
    setup: [
      "Generate copy-ready listing details in Trading Docks.",
      "Store the published listing URL.",
      "Confirm a sale before inventory is deducted.",
    ],
  },
  {
    id: "misprint",
    name: "Misprint Marketplace",
    games: "Pokémon specialty inventory",
    description: "Track specialty listings, URLs, offers, and confirmed sales.",
    methods: ["email", "manual"],
    recommended: "manual",
    setup: [
      "Create the listing using copy-ready Trading Docks details.",
      "Save its external URL and asking price.",
      "Use email tracking when reliable order messages are available.",
    ],
  },
];

export function MarketplaceWorkspace() {
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [selected, setSelected] = useState<MarketplaceDefinition | null>(null);
  const [method, setMethod] = useState<ConnectionMethod>("manual");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [databaseReady, setDatabaseReady] = useState(true);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [activeView, setActiveView] = useState<"connections" | "semi-sync" | "email">("connections");

  useEffect(() => {
    void supabase
      .from("marketplace_connections")
      .select("marketplace_id,connection_method,status,settings,last_sync_at")
      .then(({ data, error }) => {
        if (error) {
          setDatabaseReady(false);
        } else {
          setConnections((data ?? []) as SavedConnection[]);
        }
        setLoading(false);
      });
  }, [supabase]);

  const filtered = marketplaces.filter((marketplace) =>
    `${marketplace.name} ${marketplace.games} ${marketplace.description}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  function openSetup(marketplace: MarketplaceDefinition) {
    const existing = connections.find((item) => item.marketplace_id === marketplace.id);
    setSelected(marketplace);
    setMethod(existing?.connection_method ?? marketplace.recommended);
    setNotice("");
  }

  async function saveConnection() {
    if (!selected) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Your session expired. Sign in again.");
      setSaving(false);
      return;
    }
    const nextStatus: ConnectionStatus =
      method === "manual" || method === "csv" ? "ready" : "setup_required";
    const { error } = await supabase.from("marketplace_connections").upsert(
      {
        user_id: user.id,
        marketplace_id: selected.id,
        connection_method: method,
        status: nextStatus,
        settings: { setup_started: true },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marketplace_id" },
    );
    if (error) {
      setNotice(`Could not save: ${error.message}`);
    } else {
      setConnections((current) => [
        ...current.filter((item) => item.marketplace_id !== selected.id),
        {
          marketplace_id: selected.id,
          connection_method: method,
          status: nextStatus,
          settings: { setup_started: true },
          last_sync_at: null,
        },
      ]);
      setNotice(
        nextStatus === "ready"
          ? `${selected.name} is ready for ${METHOD_LABELS[method].toLowerCase()}.`
          : `${selected.name} setup saved. Complete the authorization steps when credentials are available.`,
      );
    }
    setSaving(false);
  }

  async function inspectCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const headers = (lines[0] ?? "").split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
    const headerText = headers.join(" ").toLowerCase();
    const kind = /order|buyer|shipping|sale/.test(headerText)
      ? "orders"
      : /product|quantity|condition|price|sku/.test(headerText)
        ? "inventory"
        : "unknown";
    setCsvPreview({
      name: file.name,
      rows: Math.max(lines.length - 1, 0),
      headers: headers.slice(0, 8),
      kind,
    });
    setNotice("");
  }

  async function recordSemiSync() {
    if (!csvPreview) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Your session expired. Sign in again.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("marketplace_sync_runs").insert({
      user_id: user.id,
      marketplace_id: "tcgplayer",
      sync_type: csvPreview.kind === "unknown" ? "csv_review" : `${csvPreview.kind}_csv`,
      status: "reviewed",
      records_seen: csvPreview.rows,
      records_changed: 0,
      summary: { filename: csvPreview.name, headers: csvPreview.headers },
    });
    setNotice(
      error
        ? `Could not record semi-sync: ${error.message}`
        : `TCGplayer ${csvPreview.kind} file reviewed. ${csvPreview.rows.toLocaleString("en-US")} rows are ready for the mapping stage.`,
    );
    setSaving(false);
  }

  return (
    <div className="mx-auto w-full max-w-[1640px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.1),transparent_34%),#06131d] p-6 shadow-[0_30px_90px_rgba(0,0,0,.3)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">
              <ShieldCheck className="h-4 w-4" />
              Seller & Store workspace
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Marketplace Integration Center</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Use approved APIs where available, semi-sync files where they are not, and guided tracking everywhere else—without storing marketplace passwords.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[.08] bg-black/15 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">Connector coverage</p>
            <p className="mt-1 text-lg font-semibold text-white">{marketplaces.length} channels</p>
          </div>
        </div>
      </section>

      {!databaseReady ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div><p className="text-xs font-semibold">Marketplace database setup required</p><p className="mt-1 text-[11px] text-amber-100/55">Apply the included Supabase migration, then refresh this page.</p></div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[.07] bg-[#06121b] p-2">
        {([
          ["connections", Store, "Connections"],
          ["semi-sync", FileSpreadsheet, "TCGplayer Semi-Sync"],
          ["email", Mail, "Email Tracking"],
        ] as const).map(([id, Icon, label]) => (
          <button key={id} type="button" onClick={() => setActiveView(id)} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-[11px] font-semibold transition ${activeView === id ? "border border-cyan-300/15 bg-cyan-300/[.065] text-cyan-100" : "text-slate-500 hover:bg-white/[.025] hover:text-slate-300"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {activeView === "connections" ? (
        <>
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-white/[.07] bg-[#06121b] px-4">
            <Search className="h-4 w-4 text-slate-600" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search marketplaces, games, or connection types…" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-700" />
          </label>
          {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-cyan-300" />Loading marketplace settings…</div> : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((marketplace) => {
                const connection = connections.find((item) => item.marketplace_id === marketplace.id);
                const needsAttention = connection?.status === "attention" || connection?.status === "setup_required";
                return (
                  <article key={marketplace.id} className="rounded-[22px] border border-white/[.08] bg-[#07141e]/90 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/[.06]"><Store className="h-5 w-5 text-cyan-300" /></div>
                      {needsAttention ? <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/[.05] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-amber-200"><AlertTriangle className="h-3 w-3" />Setup required</span> : null}
                    </div>
                    <h2 className="mt-5 text-lg font-semibold text-white">{marketplace.name}</h2>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-cyan-300/80">{marketplace.games}</p>
                    <p className="mt-3 min-h-12 text-xs leading-5 text-slate-500">{marketplace.description}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {marketplace.methods.map((item) => <span key={item} className="rounded-lg border border-white/[.07] bg-white/[.025] px-2 py-1 text-[9px] text-slate-500">{METHOD_LABELS[item]}</span>)}
                    </div>
                    <button type="button" onClick={() => openSetup(marketplace)} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/[.045] text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/[.08]">
                      <Settings2 className="h-3.5 w-3.5" />{connection ? "Manage connection" : "Start setup"}
                    </button>
                  </article>
                );
              })}
            </section>
          )}
        </>
      ) : null}

      {activeView === "semi-sync" ? (
        <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">TCGplayer semi-sync</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Review a seller export</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Trading Docks reads the file you select, identifies inventory or order data, and stages it for review. Nothing is changed on TCGplayer automatically.</p>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectCsv(file); }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[.025] text-cyan-100 transition hover:bg-cyan-300/[.05]">
              <Upload className="h-6 w-6 text-cyan-300" /><span className="mt-3 text-xs font-semibold">Choose TCGplayer CSV</span><span className="mt-1 text-[10px] text-slate-600">Inventory or order export</span>
            </button>
            {csvPreview ? (
              <div className="mt-4 rounded-2xl border border-white/[.08] bg-black/15 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-white">{csvPreview.name}</p><p className="mt-1 text-[10px] text-slate-500">{csvPreview.rows.toLocaleString("en-US")} rows · Detected as {csvPreview.kind}</p></div><Check className="h-4 w-4 text-emerald-300" /></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{csvPreview.headers.map((header) => <span key={header} className="rounded-lg border border-white/[.07] px-2 py-1 text-[9px] text-slate-500">{header || "Unnamed"}</span>)}</div>
                <button type="button" disabled={saving || !databaseReady} onClick={() => void recordSemiSync()} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}Stage for mapping</button>
              </div>
            ) : null}
          </div>
          <SetupGuide title="Export from TCGplayer" steps={["Open the TCGplayer Seller Portal.", "Export inventory or orders as CSV.", "Return here and select the exported file.", "Review unmatched cards before approving any inventory deduction.", "Generate a TCGplayer-formatted update file when changes need to go back."]} />
        </section>
      ) : null}

      {activeView === "email" ? (
        <section className="grid gap-5 lg:grid-cols-3">
          <EmailMethod icon={KeyRound} title="Gmail OAuth" detail="Authorize read-only access to matching order emails. Trading Docks should never receive the Gmail password." status="Provider setup required" />
          <EmailMethod icon={KeyRound} title="Outlook OAuth" detail="Authorize a Microsoft mailbox and limit processing to marketplace order messages." status="Provider setup required" />
          <EmailMethod icon={Inbox} title="Email forwarding" detail="Forward marketplace order notices to a unique Trading Docks inbound address once the inbound-email provider is configured." status="Inbound domain required" />
          <div className="lg:col-span-3 rounded-[24px] border border-emerald-300/10 bg-emerald-300/[.025] p-5">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><h3 className="text-sm font-semibold text-emerald-100">Safe order-email design</h3><p className="mt-2 text-xs leading-5 text-emerald-100/55">Only messages matching approved marketplace senders and order patterns should be processed. Store extracted order fields—not the complete mailbox—and require confirmation before ambiguous messages reduce inventory.</p></div></div>
          </div>
        </section>
      ) : null}

      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[180] max-w-sm rounded-2xl border border-cyan-300/15 bg-[#0a1a24] px-4 py-3 text-xs font-medium leading-5 text-cyan-100 shadow-2xl">{notice}</div> : null}

      {selected ? (
        <div className="fixed inset-0 z-[170] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[26px] border border-white/[.1] bg-[#06131d] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/[.07] p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Connection setup</p><h2 className="mt-2 text-xl font-semibold text-white">{selected.name}</h2><p className="mt-1 text-xs text-slate-500">{selected.games}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-white/[.08] p-2 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="space-y-5 p-5 sm:p-6">
              <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-600">Choose connection method</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.methods.map((item) => <button key={item} type="button" onClick={() => setMethod(item)} className={`flex items-center justify-between rounded-xl border p-3 text-left text-xs font-semibold transition ${method === item ? "border-cyan-300/25 bg-cyan-300/[.065] text-cyan-100" : "border-white/[.07] bg-black/10 text-slate-500"}`}><span>{METHOD_LABELS[item]}</span>{method === item ? <Check className="h-4 w-4 text-cyan-300" /> : null}</button>)}</div></div>
              <SetupGuide title={`${selected.name} setup`} steps={selected.setup} compact />
              {method === "api" ? <div className="flex gap-3 rounded-2xl border border-amber-300/12 bg-amber-300/[.03] p-4"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p className="text-[11px] leading-5 text-amber-100/55">This release saves the approved connector choice and setup state. OAuth credentials and tokens must be added through server-side encrypted storage in the marketplace-specific connector phase.</p></div> : null}
              <button type="button" disabled={saving || !databaseReady} onClick={() => void saveConnection()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}Save connection plan</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SetupGuide({ title, steps, compact = false }: { title: string; steps: readonly string[]; compact?: boolean }) {
  return <div className={`rounded-[24px] border border-white/[.08] bg-[#07141e] ${compact ? "p-4" : "p-6"}`}><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">{title}</p><div className="mt-4 space-y-3">{steps.map((step, index) => <div key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[.05] text-[9px] font-bold text-cyan-200">{index + 1}</span><p className="pt-0.5 text-[11px] leading-5 text-slate-500">{step}</p></div>)}</div></div>;
}

function EmailMethod({ icon: Icon, title, detail, status }: { icon: typeof Mail; title: string; detail: string; status: string }) {
  return <article className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-5"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.05]"><Icon className="h-5 w-5 text-cyan-300" /></div><h2 className="mt-4 text-sm font-semibold text-white">{title}</h2><p className="mt-2 min-h-16 text-[11px] leading-5 text-slate-500">{detail}</p><div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/10 bg-amber-300/[.025] px-3 py-2 text-[9px] font-semibold uppercase tracking-[.12em] text-amber-200"><RefreshCw className="h-3 w-3" />{status}</div></article>;
}
