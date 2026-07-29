"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  ExternalLink,
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
  Activity,
  Eye,
  Link2,
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
  officialUrl?: string;
  callbackSlug?: string;
  credentialFields?: CredentialField[];
};
type CredentialField = {
  key: string;
  label: string;
  placeholder: string;
  help: string;
  secret?: boolean;
};
type SavedConnection = {
  marketplace_id: string;
  connection_method: ConnectionMethod;
  status: ConnectionStatus;
  settings: Record<string, unknown> | null;
  last_sync_at: string | null;
  sync_mode?: "read_only" | "preview" | "automatic";
  health?: "not_connected" | "healthy" | "attention" | "expired";
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

const MARKETPLACE_CALLBACK_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://www.tradingdocks.com";

const marketplaces: MarketplaceDefinition[] = [
  {
    id: "tcgplayer",
    name: "TCGplayer",
    games: "Magic · Pokémon · Lorcana · Yu-Gi-Oh!",
    description: "Import seller inventory and orders without storing a TCGplayer password.",
    methods: ["api", "csv", "email", "manual"],
    recommended: "csv",
    setup: [
      "Export inventory or orders from the TCGplayer Seller Portal.",
      "Upload the CSV in Semi-Sync and review every proposed change.",
      "Optionally connect order-email tracking for faster sale notifications.",
      "Use the generated export when Trading Docks needs to send changes back.",
    ],
    officialUrl: "https://developer.tcgplayer.com/",
    credentialFields: [
      { key: "publicKey", label: "Public API key", placeholder: "Your existing public key", help: "Only use this option if TCGplayer previously issued API credentials to your account." },
      { key: "privateKey", label: "Private API key", placeholder: "Your existing private key", help: "Stored encrypted and never shown again.", secret: true },
      { key: "applicationId", label: "Application ID", placeholder: "Application ID", help: "The application identifier shown with your existing credentials." },
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
    officialUrl: "https://developer.ebay.com/my/keys",
    callbackSlug: "ebay",
    credentialFields: [
      { key: "environment", label: "Environment", placeholder: "production or sandbox", help: "Use production for a live seller account; sandbox is for eBay test accounts." },
      { key: "clientId", label: "Client ID (App ID)", placeholder: "Your eBay App ID", help: "Found under your eBay application keyset." },
      { key: "clientSecret", label: "Client secret (Cert ID)", placeholder: "Your eBay Cert ID", help: "Stored encrypted and never shown again.", secret: true },
      { key: "ruName", label: "RuName", placeholder: "Your OAuth redirect name", help: "The RuName created in eBay User Tokens settings." },
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
    officialUrl: "https://dev.shopify.com/dashboard",
    callbackSlug: "shopify",
    credentialFields: [
      { key: "shopDomain", label: "Shop domain", placeholder: "your-store.myshopify.com", help: "Use the permanent myshopify.com domain, not a custom storefront domain." },
      { key: "clientId", label: "Client ID", placeholder: "Shopify app client ID", help: "Found in your app's credentials page." },
      { key: "clientSecret", label: "Client secret", placeholder: "Shopify app client secret", help: "Stored encrypted and never shown again.", secret: true },
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
    officialUrl: "https://manapool.com/",
    credentialFields: [
      { key: "apiToken", label: "Seller API token", placeholder: "Approved Mana Pool token", help: "Only enter a token issued or approved for your seller account.", secret: true },
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
    officialUrl: "https://www.cardtrader.com/docs/api/full",
    credentialFields: [
      { key: "apiToken", label: "API token", placeholder: "CardTrader API token", help: "Create or locate the token in your CardTrader account API settings.", secret: true },
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
    officialUrl: "https://www.cardsphere.com/",
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
    officialUrl: "https://developers.whatnot.com/",
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
    officialUrl: "https://www.etsy.com/developers/your-apps",
    callbackSlug: "etsy",
    credentialFields: [
      { key: "keystring", label: "Keystring", placeholder: "Etsy application keystring", help: "The client identifier shown on the Etsy app page." },
      { key: "sharedSecret", label: "Shared secret", placeholder: "Etsy shared secret", help: "Stored encrypted and never shown again.", secret: true },
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
    officialUrl: "https://developer-docs.amazon.com/sp-api/docs/registering-your-application",
    callbackSlug: "amazon",
    credentialFields: [
      { key: "sellerId", label: "Seller ID", placeholder: "Amazon merchant/seller ID", help: "Found in Seller Central account information." },
      { key: "lwaClientId", label: "LWA client ID", placeholder: "Login with Amazon client ID", help: "Issued with your SP-API application." },
      { key: "lwaClientSecret", label: "LWA client secret", placeholder: "Login with Amazon secret", help: "Stored encrypted and never shown again.", secret: true },
      { key: "refreshToken", label: "Refresh token", placeholder: "SP-API refresh token", help: "Created when the seller authorizes the application.", secret: true },
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
    officialUrl: "https://woocommerce.com/document/woocommerce-rest-api/",
    credentialFields: [
      { key: "storeUrl", label: "Store URL", placeholder: "https://store.example.com", help: "The HTTPS address of the WooCommerce store." },
      { key: "consumerKey", label: "Consumer key", placeholder: "ck_…", help: "Create a read/write key in WooCommerce → Settings → Advanced → REST API." },
      { key: "consumerSecret", label: "Consumer secret", placeholder: "cs_…", help: "Stored encrypted and never shown again.", secret: true },
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
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  useEffect(() => {
    void supabase
      .from("marketplace_connections")
      .select("marketplace_id,connection_method,status,settings,last_sync_at,sync_mode,health")
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
  const connectedCount = connections.filter((item) => item.status === "ready").length;
  const attentionCount = connections.filter((item) => item.status === "attention" || item.status === "setup_required").length;

  function openSetup(marketplace: MarketplaceDefinition) {
    const existing = connections.find((item) => item.marketplace_id === marketplace.id);
    setSelected(marketplace);
    setMethod(existing?.connection_method ?? marketplace.recommended);
    setCredentials({});
    setNotice("");
  }

  async function copyCallbackUrl() {
    if (!selected?.callbackSlug) return;
    const callbackUrl = `${MARKETPLACE_CALLBACK_ORIGIN}/api/marketplaces/${selected.callbackSlug}/callback`;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setNotice("Callback URL copied.");
    } catch {
      setNotice("Select the callback URL and copy it manually.");
    }
  }

  async function saveCredentials() {
    if (!selected?.credentialFields?.length) return;
    const missing = selected.credentialFields.find((field) => !credentials[field.key]?.trim());
    if (missing) {
      setNotice(`${missing.label} is required.`);
      return;
    }
    setSaving(true);
    const response = await fetch("/api/marketplaces/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplaceId: selected.id, credentials }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setNotice(result?.error ?? "Could not save encrypted credentials.");
    } else {
      setConnections((current) => [
        ...current.filter((item) => item.marketplace_id !== selected.id),
        {
          marketplace_id: selected.id,
          connection_method: "api",
          status: "setup_required",
          settings: { credentials_saved: true },
          last_sync_at: null,
        },
      ]);
      setCredentials({});
      setNotice(`${selected.name} credentials were encrypted and saved. Authorization is the next step.`);
    }
    setSaving(false);
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard icon={Link2} label="Connected channels" value={String(connectedCount)} detail={`${marketplaces.length} supported destinations`} tone="cyan" />
        <HealthCard icon={Eye} label="Default sync mode" value="Read only" detail="No marketplace writes are enabled" tone="emerald" />
        <HealthCard icon={Activity} label="Connection health" value={attentionCount ? `${attentionCount} to finish` : "All clear"} detail={attentionCount ? "Setup or authorization required" : "No connector issues"} tone={attentionCount ? "amber" : "emerald"} />
        <HealthCard icon={ShieldCheck} label="Activation safety" value="Preview first" detail="Approve changes before live sync" tone="cyan" />
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
              {method === "api" ? (
                <div className="space-y-4 rounded-[22px] border border-cyan-300/12 bg-cyan-300/[.025] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-cyan-100">Your developer credentials</p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">Create credentials in your own marketplace account, then enter them here. Never enter your marketplace password.</p>
                    </div>
                    {selected.officialUrl ? (
                      <a href={selected.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300/15 px-2.5 py-2 text-[9px] font-semibold text-cyan-200 hover:bg-cyan-300/[.06]">
                        Official setup <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  {selected.callbackSlug ? (
                    <div>
                      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-slate-600">OAuth callback URL</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${MARKETPLACE_CALLBACK_ORIGIN}/api/marketplaces/${selected.callbackSlug}/callback`}
                          onFocus={(event) => event.currentTarget.select()}
                          aria-label={`${selected.name} OAuth callback URL`}
                          className="min-w-0 flex-1 rounded-xl border border-white/[.07] bg-black/20 px-3 py-2.5 font-mono text-[10px] text-slate-300 outline-none focus:border-cyan-300/30"
                        />
                        <button type="button" onClick={() => void copyCallbackUrl()} className="rounded-xl border border-white/[.08] px-3 text-slate-400 hover:text-white" aria-label="Copy callback URL"><Copy className="h-4 w-4" /></button>
                      </div>
                      <p className="mt-1.5 text-[9px] leading-4 text-slate-600">This address is generated by Trading Docks. Select it or use the copy button, then paste it into the marketplace app’s redirect/callback setting.</p>
                    </div>
                  ) : null}
                  {selected.credentialFields?.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selected.credentialFields.map((field) => (
                        <label key={field.key} className="block">
                          <span className="text-[10px] font-semibold text-slate-300">{field.label}</span>
                          <input
                            type={field.secret ? "password" : "text"}
                            value={credentials[field.key] ?? ""}
                            onChange={(event) => setCredentials((current) => ({ ...current, [field.key]: event.target.value }))}
                            placeholder={field.placeholder}
                            autoComplete="off"
                            className="mt-1.5 h-10 w-full rounded-xl border border-white/[.08] bg-black/20 px-3 text-xs text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/30"
                          />
                          <span className="mt-1 block text-[9px] leading-4 text-slate-600">{field.help}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 rounded-2xl border border-amber-300/12 bg-amber-300/[.03] p-4"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p className="text-[11px] leading-5 text-amber-100/55">This marketplace does not currently publish a supported self-service API credential flow. Choose CSV, email, or guided manual tracking.</p></div>
                  )}
                  <div className="flex gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[.025] p-3 text-[10px] leading-4 text-emerald-100/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />Secrets are encrypted on the server with AES-256-GCM. The page receives only masked confirmation after saving.</div>
                  {selected.id === "ebay" && connections.some((item) => item.marketplace_id === "ebay" && item.settings?.credentials_saved) ? (
                    <a href="/api/marketplaces/ebay/authorize" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.07] text-xs font-bold text-emerald-100 hover:bg-emerald-300/[.12]">
                      <Link2 className="h-4 w-4" />Authorize eBay read-only access
                    </a>
                  ) : null}
                </div>
              ) : null}
              <button type="button" disabled={saving || !databaseReady || (method === "api" && !selected.credentialFields?.length)} onClick={() => void (method === "api" ? saveCredentials() : saveConnection())} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{method === "api" ? "Encrypt & save credentials" : "Save connection plan"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Store;
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "emerald" | "amber";
}) {
  const colors = tone === "emerald"
    ? "border-emerald-300/12 bg-emerald-300/[.025] text-emerald-300"
    : tone === "amber"
      ? "border-amber-300/12 bg-amber-300/[.025] text-amber-300"
      : "border-cyan-300/12 bg-cyan-300/[.025] text-cyan-300";
  return <article className={`rounded-[20px] border p-4 ${colors}`}><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.15em]"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-3 text-lg font-semibold text-white">{value}</p><p className="mt-1 text-[10px] text-slate-500">{detail}</p></article>;
}

function SetupGuide({ title, steps, compact = false }: { title: string; steps: readonly string[]; compact?: boolean }) {
  return <div className={`rounded-[24px] border border-white/[.08] bg-[#07141e] ${compact ? "p-4" : "p-6"}`}><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">{title}</p><div className="mt-4 space-y-3">{steps.map((step, index) => <div key={step} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[.05] text-[9px] font-bold text-cyan-200">{index + 1}</span><p className="pt-0.5 text-[11px] leading-5 text-slate-500">{step}</p></div>)}</div></div>;
}

function EmailMethod({ icon: Icon, title, detail, status }: { icon: typeof Mail; title: string; detail: string; status: string }) {
  return <article className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-5"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.05]"><Icon className="h-5 w-5 text-cyan-300" /></div><h2 className="mt-4 text-sm font-semibold text-white">{title}</h2><p className="mt-2 min-h-16 text-[11px] leading-5 text-slate-500">{detail}</p><div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/10 bg-amber-300/[.025] px-3 py-2 text-[9px] font-semibold uppercase tracking-[.12em] text-amber-200"><RefreshCw className="h-3 w-3" />{status}</div></article>;
}
