"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  LockKeyhole,
  MousePointerClick,
  Send,
  Sparkles,
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
type SavedCredentials = {
  saved: boolean;
  masked: Record<string, string>;
  updatedAt: string | null;
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
      "Sign in to your Mana Pool seller account.",
      "Open Seller Tools → Integrations → Mana Pool API.",
      "Generate or copy your seller API key.",
      "Return to Trading Docks and paste the key into the secure token field.",
      "Save the credentials, then begin with read-only inventory and pricing sync.",
    ],
    officialUrl: "https://manapool.com/seller/integrations/manapool-api",
    credentialFields: [
      { key: "apiToken", label: "Mana Pool seller API key", placeholder: "Paste the key from Mana Pool", help: "Generate it at manapool.com/seller/integrations/manapool-api. It is stored encrypted and never shown again.", secret: true },
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
  const [savedCredentials, setSavedCredentials] = useState<Record<string, SavedCredentials>>({});
  const [checkingCredentials, setCheckingCredentials] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState<Record<string, boolean>>({});
  const [emailProvider, setEmailProvider] = useState<"gmail" | "outlook">("gmail");
  const [emailMarketplace, setEmailMarketplace] = useState("tcgplayer");
  const [emailSetupStep, setEmailSetupStep] = useState(1);
  const [importAddress, setImportAddress] = useState("Loading permanent address…");
  const [importAddressStatus, setImportAddressStatus] = useState("loading");
  const [emailProcessing, setEmailProcessing] = useState(false);

  const loadCredentialStatus = useCallback(async (marketplaceId: string) => {
    setCheckingCredentials(true);
    try {
      const response = await fetch(
        `/api/marketplaces/credentials?marketplaceId=${encodeURIComponent(marketplaceId)}`,
        { cache: "no-store" },
      );
      const result = (await response.json().catch(() => null)) as
        | (SavedCredentials & { error?: string })
        | null;
      if (response.ok && result) {
        setSavedCredentials((current) => ({ ...current, [marketplaceId]: result }));
      }
    } finally {
      setCheckingCredentials(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connector = params.get("connector");
    const error = params.get("error");
    const authorization = params.get("authorization");
    if (connector === "ebay") {
      setSelected(marketplaces.find((marketplace) => marketplace.id === "ebay") ?? null);
      setMethod("api");
    }
    const messages: Record<string, string> = {
      credentials: "Save your eBay developer credentials before authorizing the connection.",
      credentials_incomplete: "Your saved eBay credentials are incomplete. Enter all four fields and save them again.",
      credentials_key_changed: "Your encryption key changed after these eBay credentials were saved. Enter and save the credentials again, then authorize eBay.",
      authorization_setup: "Trading Docks could not start eBay authorization. Confirm the server environment variables, then save your credentials again.",
      server_service_key: "eBay authorization needs SUPABASE_SERVICE_ROLE_KEY in the deployed server environment. Add it in Vercel, redeploy, and try again.",
      server_encryption_key: "eBay authorization needs MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY in the deployed server environment. Add it in Vercel, redeploy, then save the credentials again.",
      invalid_state: "The eBay authorization session expired or could not be verified. Start authorization again.",
      token_exchange: "eBay authorization returned, but the token could not be saved. Confirm the Production Client ID, Client Secret, and RuName.",
    };
    if (error && messages[error]) setNotice(messages[error]);
    if (connector === "ebay" && authorization === "connected") {
      setNotice("eBay is connected. Your credentials and authorization will remain saved.");
    }
    if (connector === "ebay") void loadCredentialStatus("ebay");

    void (async () => {
      const { data, error: connectionError } = await supabase
        .from("marketplace_connections")
        .select("marketplace_id,connection_method,status,settings,last_sync_at,sync_mode,health");
      if (connectionError) {
        setDatabaseReady(false);
      } else {
        setConnections((data ?? []) as SavedConnection[]);
      }
      const mailboxResponse = await fetch("/api/marketplaces/email-inbox", {
        cache: "no-store",
      });
      const mailbox = (await mailboxResponse.json().catch(() => null)) as {
        address?: string;
        status?: string;
        error?: string;
        marketplaceId?: string;
        provider?: string;
        connectionStatus?: string;
        lastReceivedAt?: string | null;
      } | null;

      if (mailboxResponse.ok && mailbox?.address) {
        setImportAddress(mailbox.address);
        setImportAddressStatus(mailbox.status ?? "pending");

        if (mailbox.connectionStatus === "ready") {
          const marketplaceId = mailbox.marketplaceId ?? "tcgplayer";
          setConnections((current) => [
            ...current.filter((item) => item.marketplace_id !== marketplaceId),
            {
              marketplace_id: marketplaceId,
              connection_method: "email",
              status: "ready",
              settings: {
                permanent_inbound_address: true,
                email_provider: mailbox.provider ?? "gmail",
                mailbox_status: mailbox.status ?? "active",
              },
              last_sync_at: mailbox.lastReceivedAt ?? null,
            },
          ]);
        }
      } else {
        setImportAddress("Permanent address unavailable");
        setImportAddressStatus("error");
        if (mailbox?.error) setNotice(mailbox.error);
      }
      setLoading(false);
    })();
  }, [loadCredentialStatus, supabase]);

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
    setEditingCredentials((current) => ({ ...current, [marketplace.id]: false }));
    setNotice("");
    if (marketplace.credentialFields?.length) void loadCredentialStatus(marketplace.id);
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
      setEditingCredentials((current) => ({ ...current, [selected.id]: false }));
      setSavedCredentials((current) => ({
        ...current,
        [selected.id]: {
          saved: true,
          masked: (result as { masked?: Record<string, string> } | null)?.masked ?? {},
          updatedAt: new Date().toISOString(),
        },
      }));
      setNotice(`${selected.name} credentials were encrypted and saved. Authorization is the next step.`);
    }
    setSaving(false);
  }

  async function saveConnection(): Promise<boolean> {
    if (!selected) return false;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNotice("Your session expired. Sign in again.");
      setSaving(false);
      return false;
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
    return !error;
  }

  async function continueSetup() {
    if (!selected) return;
    const marketplaceId = selected.id;
    const marketplaceName = selected.name;
    const selectedMethod = method;
    const saved = await saveConnection();
    if (!saved) return;

    if (selectedMethod === "email") {
      setEmailMarketplace(marketplaceId);
      setEmailSetupStep(1);
      setSelected(null);
      setActiveView("email");
      setNotice(`${marketplaceName} selected. Start with Step 1 below.`);
      return;
    }

    if (selectedMethod === "csv" && marketplaceId === "tcgplayer") {
      setSelected(null);
      setActiveView("semi-sync");
      setNotice("TCGplayer selected. Choose an inventory or order CSV below.");
    }
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
                const isConnected = connection?.status === "ready";
                const needsAttention = connection?.status === "attention" || connection?.status === "setup_required";
                return (
                  <article key={marketplace.id} className="rounded-[22px] border border-white/[.08] bg-[#07141e]/90 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/[.06]"><Store className="h-5 w-5 text-cyan-300" /></div>
                      {isConnected ? <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/[.05] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-200"><Check className="h-3 w-3" />Connected</span> : null}
                      {!isConnected && needsAttention ? <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/[.05] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-amber-200"><AlertTriangle className="h-3 w-3" />Setup required</span> : null}
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
        <EmailImportSetup
          provider={emailProvider}
          setProvider={setEmailProvider}
          marketplace={emailMarketplace}
          setMarketplace={setEmailMarketplace}
          step={emailSetupStep}
          setStep={setEmailSetupStep}
          importAddress={importAddress}
          importAddressStatus={importAddressStatus}
          setImportAddressStatus={setImportAddressStatus}
          emailProcessing={emailProcessing}
          setEmailProcessing={setEmailProcessing}
          onNotice={setNotice}
        />
      ) : null}

      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[180] max-w-sm rounded-2xl border border-cyan-300/15 bg-[#0a1a24] px-4 py-3 text-xs font-medium leading-5 text-cyan-100 shadow-2xl">{notice}</div> : null}

      {selected ? (
        <div className="fixed inset-0 z-[170] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[26px] border border-white/[.1] bg-[#06131d] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/[.07] p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Connection setup</p><h2 className="mt-2 text-xl font-semibold text-white">{selected.name}</h2><p className="mt-1 text-xs text-slate-500">{selected.games}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-white/[.08] p-2 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="space-y-5 p-5 sm:p-6">
              <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-600">Choose connection method</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.methods.map((item) => <button key={item} type="button" onClick={() => setMethod(item)} className={`flex items-center justify-between rounded-xl border p-3 text-left text-xs font-semibold transition ${method === item ? "border-cyan-300/25 bg-cyan-300/[.065] text-cyan-100" : "border-white/[.07] bg-black/10 text-slate-500"}`}><span>{METHOD_LABELS[item]}</span>{method === item ? <Check className="h-4 w-4 text-cyan-300" /> : null}</button>)}</div></div>
              <SetupGuide title={`${selected.name} setup`} steps={selected.setup} compact />
              {selected.id === "mana-pool" && method === "api" ? (
                <div className="rounded-[22px] border border-violet-300/15 bg-gradient-to-b from-violet-300/[.05] to-transparent p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-300">Mana Pool API setup</p>
                      <h3 className="mt-2 text-base font-semibold text-white">Connect your seller account in four steps</h3>
                      <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">Generate the key inside Mana Pool, then securely save it in Trading Docks. Your marketplace password is never requested.</p>
                    </div>
                    <a href="https://manapool.com/seller/integrations/manapool-api" target="_blank" rel="noopener noreferrer" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 text-[10px] font-bold text-[#080312] hover:bg-violet-300">Open Mana Pool settings <ExternalLink className="h-3.5 w-3.5" /></a>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {[
                      ["1", "Open settings", "Use the official seller integration page."],
                      ["2", "Generate key", "Create or copy the Mana Pool API key."],
                      ["3", "Paste securely", "Enter it in the encrypted field below."],
                      ["4", "Save & test", "Start read-only before enabling automation."],
                    ].map(([number, title, detail]) => (
                      <div key={number} className="rounded-xl border border-white/[.07] bg-black/[.14] p-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-300/[.11] text-[9px] font-bold text-violet-300">{number}</span>
                        <p className="mt-2 text-[9px] font-semibold text-white">{title}</p>
                        <p className="mt-1 text-[8px] leading-4 text-slate-600">{detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/12 bg-emerald-300/[.03] p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <p className="text-[9px] leading-4 text-emerald-100/60">Trading Docks stores the key through the existing encrypted marketplace-credential system. It is not saved in browser storage or committed to GitHub.</p>
                  </div>
                </div>
              ) : null}

              {method === "api" ? (
                <div className="space-y-4 rounded-[22px] border border-cyan-300/12 bg-cyan-300/[.025] p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="text-xs font-semibold text-cyan-100">Secure platform connection</p>
                      <p className="mt-1 text-[10px] leading-5 text-slate-500">Trading Docks manages marketplace application credentials. You will never be asked for a Client Secret, API key, RuName, encryption key, or marketplace password here.</p>
                    </div>
                  </div>
                  {selected.id === "ebay" ? (
                    <>
                      <div className="rounded-xl border border-white/[.07] bg-black/15 p-3">
                        <p className="text-[10px] font-semibold text-slate-200">Your eBay seller account</p>
                        <p className="mt-1 text-[9px] leading-4 text-slate-600">eBay will open its own secure sign-in page. Approval connects only this Trading Docks account and keeps every store’s listings and tokens separate.</p>
                      </div>
                      <a href="/api/marketplaces/ebay/authorize" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.07] text-xs font-bold text-emerald-100 hover:bg-emerald-300/[.12]">
                        <Link2 className="h-4 w-4" />{connections.some((item) => item.marketplace_id === "ebay" && item.status === "ready") ? "Reconnect eBay account" : "Connect eBay account"}
                      </a>
                      {connections.some((item) => item.marketplace_id === "ebay" && item.status === "ready") ? (
                        <a href="/dashboard/marketplaces/ebay" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950 hover:bg-cyan-200">
                          <RefreshCw className="h-4 w-4" />Open Import & Reconciliation
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-xl border border-amber-300/12 bg-amber-300/[.03] p-3 text-[10px] leading-5 text-amber-100/55">This connection will become available here after the Trading Docks administrator activates the platform integration. No developer setup will be required from your store.</div>
                  )}
                </div>
              ) : null}
              {(() => {
                if (!selected) return null;
                const legacySelected = selected;
                return false && method === "api" ? (
                <div className="space-y-4 rounded-[22px] border border-cyan-300/12 bg-cyan-300/[.025] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-cyan-100">Your developer credentials</p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">Create credentials in your own marketplace account, then enter them here. Never enter your marketplace password.</p>
                    </div>
                    {selected!.officialUrl ? (
                      <a href={selected!.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300/15 px-2.5 py-2 text-[9px] font-semibold text-cyan-200 hover:bg-cyan-300/[.06]">
                        Official setup <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  {legacySelected.callbackSlug ? (
                    <div>
                      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-slate-600">OAuth callback URL</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${MARKETPLACE_CALLBACK_ORIGIN}/api/marketplaces/${legacySelected.callbackSlug}/callback`}
                          onFocus={(event) => event.currentTarget.select()}
                          aria-label={`${legacySelected.name} OAuth callback URL`}
                          className="min-w-0 flex-1 rounded-xl border border-white/[.07] bg-black/20 px-3 py-2.5 font-mono text-[10px] text-slate-300 outline-none focus:border-cyan-300/30"
                        />
                        <button type="button" onClick={() => void copyCallbackUrl()} className="rounded-xl border border-white/[.08] px-3 text-slate-400 hover:text-white" aria-label="Copy callback URL"><Copy className="h-4 w-4" /></button>
                      </div>
                      <p className="mt-1.5 text-[9px] leading-4 text-slate-600">This address is generated by Trading Docks. Select it or use the copy button, then paste it into the marketplace app’s redirect/callback setting.</p>
                    </div>
                  ) : null}
                  {legacySelected.credentialFields?.length ? (
                    <div className="space-y-3">
                      {checkingCredentials ? (
                        <div className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-black/15 px-3 py-2.5 text-[10px] text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                          Checking saved credentials…
                        </div>
                      ) : savedCredentials[legacySelected.id]?.saved ? (
                        <div className="flex items-start gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[.04] px-3 py-3">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                          <div>
                            <p className="text-[11px] font-semibold text-emerald-100">Credentials saved</p>
                            <p className="mt-1 text-[9px] leading-4 text-emerald-100/55">
                              They remain encrypted on the server. Leave this form alone unless you need to replace them.
                            </p>
                          </div>
                        </div>
                      ) : null}
                      {!savedCredentials[legacySelected.id]?.saved || editingCredentials[legacySelected.id] ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {legacySelected.credentialFields!.map((field) => (
                            <label key={field.key} className="block">
                              <span className="text-[10px] font-semibold text-slate-300">{field.label}</span>
                              <input
                                type={field.secret ? "password" : "text"}
                                value={credentials[field.key] ?? ""}
                                onChange={(event) => setCredentials((current) => ({ ...current, [field.key]: event.target.value }))}
                                placeholder={
                                  savedCredentials[legacySelected.id]?.masked[field.key]
                                    ? `Saved ${savedCredentials[legacySelected.id].masked[field.key]} · enter replacement`
                                    : field.placeholder
                                }
                                autoComplete="off"
                                className="mt-1.5 h-10 w-full rounded-xl border border-white/[.08] bg-black/20 px-3 text-xs text-white outline-none placeholder:text-slate-700 focus:border-cyan-300/30"
                              />
                              <span className="mt-1 block text-[9px] leading-4 text-slate-600">{field.help}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex gap-3 rounded-2xl border border-amber-300/12 bg-amber-300/[.03] p-4"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p className="text-[11px] leading-5 text-amber-100/55">This marketplace does not currently publish a supported self-service API credential flow. Choose CSV, email, or guided manual tracking.</p></div>
                  )}
                  <div className="flex gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[.025] p-3 text-[10px] leading-4 text-emerald-100/55"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />Secrets are encrypted on the server with AES-256-GCM. The page receives only masked confirmation after saving.</div>
                  {savedCredentials[legacySelected.id]?.saved && !editingCredentials[legacySelected.id] ? (
                    <button type="button" onClick={() => setEditingCredentials((current) => ({ ...current, [legacySelected.id]: true }))} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/15 text-xs font-bold text-cyan-100 hover:bg-cyan-300/[.06]">
                      <KeyRound className="h-4 w-4" />Replace saved credentials
                    </button>
                  ) : (
                    <button type="button" disabled={saving || !databaseReady || !legacySelected.credentialFields?.length} onClick={() => void saveCredentials()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{savedCredentials[legacySelected.id]?.saved ? "Save replacement credentials" : "Encrypt & save credentials"}</button>
                  )}
                  {legacySelected.id === "ebay" && savedCredentials.ebay?.saved ? (
                    <a href="/api/marketplaces/ebay/authorize" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.07] text-xs font-bold text-emerald-100 hover:bg-emerald-300/[.12]">
                      <Link2 className="h-4 w-4" />{connections.some((item) => item.marketplace_id === "ebay" && item.status === "ready") ? "Reconnect eBay account" : "Authorize eBay read-only access"}
                    </a>
                  ) : null}
                </div>
                ) : null;
              })()}
              {method !== "api" ? <button type="button" disabled={saving || !databaseReady} onClick={() => void continueSetup()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{method === "email" ? "Open email setup" : method === "csv" && selected.id === "tcgplayer" ? "Open CSV importer" : "Save connection plan"}</button> : null}
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

function EmailImportSetup({ provider, setProvider, marketplace, setMarketplace, step, setStep, importAddress, importAddressStatus, setImportAddressStatus, emailProcessing, setEmailProcessing, onNotice }: {
  provider: "gmail" | "outlook";
  setProvider: (value: "gmail" | "outlook") => void;
  marketplace: string;
  setMarketplace: (value: string) => void;
  step: number;
  setStep: (value: number) => void;
  importAddress: string;
  importAddressStatus: string;
  setImportAddressStatus: (value: string) => void;
  emailProcessing: boolean;
  setEmailProcessing: (value: boolean) => void;
  onNotice: (value: string) => void;
}) {
  const emailMarketplaces = marketplaces.filter((item) => item.methods.includes("email"));
  const marketplaceName = emailMarketplaces.find((item) => item.id === marketplace)?.name ?? "marketplace";
  const instructions = provider === "gmail"
    ? [
        "Open Gmail on a computer and select the gear icon in the upper-right corner.",
        "Select “See all settings,” then open the “Forwarding and POP/IMAP” tab.",
        `Select “Add a forwarding address” and paste your private Trading Docks address shown on this page.`,
        "Gmail will send a confirmation message. Return to Trading Docks and select “Check for confirmation.”",
        `In Gmail, create a filter for ${marketplaceName} order emails and choose “Forward it to” your Trading Docks address.`,
      ]
    : [
        "Open Outlook on a computer and select the gear icon in the upper-right corner.",
        "Select “Mail,” then “Rules,” then choose “Add new rule.”",
        `Name the rule “Trading Docks — ${marketplaceName} orders.”`,
        `Set the condition to messages from ${marketplaceName}, then choose the action “Forward to.”`,
        "Paste your private Trading Docks address, save the rule, and return here to verify it.",
      ];
  const steps = [
    { title: "Choose what you use", detail: "Tell us where your order emails arrive and which marketplace you want to import." },
    { title: "Add your private address", detail: "Follow the exact forwarding directions. No password or full mailbox access is needed." },
    { title: "Verify one message", detail: "We confirm the first forwarded order before automatic importing can begin." },
  ];

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(importAddress);
      onNotice(
        importAddressStatus === "active"
          ? "Permanent import address copied. Email receiving is active."
          : "Private import address copied. Finish verification before forwarding live orders.",
      );
    } catch {
      onNotice("Select the address and copy it manually.");
    }
  }

  async function checkAndImportOrders() {
    setEmailProcessing(true);
    try {
      const response = await fetch("/api/orders/email-process", { method: "POST" });
      const result = (await response.json().catch(() => null)) as {
        scanned?: number;
        imported?: number;
        review?: number;
        failed?: number;
        mailboxStatus?: string;
        connectionStatus?: string;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not process forwarded emails.");

      if (result?.connectionStatus === "ready") {
        setImportAddressStatus("active");
      }

      onNotice(`Email check complete: ${result?.imported ?? 0} order messages imported, ${result?.review ?? 0} need review, ${result?.failed ?? 0} failed. TCGplayer email tracking remains connected.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not process forwarded emails.");
    } finally {
      setEmailProcessing(false);
    }
  }

  return <section className="space-y-5">
    <div className="overflow-hidden rounded-[26px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.09),transparent_38%),#07141e] p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-cyan-300"><Sparkles className="h-4 w-4" />Automatic order import by email</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Forward order emails. We organize the rest.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Trading Docks gives this workspace one private email address. You tell Gmail or Outlook to forward only marketplace order messages to it. We then identify the order, prevent duplicates, and send uncertain cards to review.</p>
        </div>
        <div className={`shrink-0 rounded-2xl border px-4 py-3 ${importAddressStatus === "active" ? "border-emerald-300/15 bg-emerald-300/[.04]" : "border-amber-300/15 bg-amber-300/[.04]"}`}>
          <p className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] ${importAddressStatus === "active" ? "text-emerald-200" : "text-amber-200"}`}>{importAddressStatus === "active" ? <ShieldCheck className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}{importAddressStatus === "active" ? "Receiving active" : "Verification pending"}</p>
          <p className={`mt-1 max-w-[240px] text-[10px] leading-4 ${importAddressStatus === "active" ? "text-emerald-100/55" : "text-amber-100/55"}`}>{importAddressStatus === "active" ? "TCGplayer order emails are connected and will continue importing for this workspace." : "Complete one forwarded-message check before sending live orders."}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">{steps.map((item, index) => <button key={item.title} type="button" onClick={() => setStep(index + 1)} className={`rounded-2xl border p-4 text-left transition ${step === index + 1 ? "border-cyan-300/25 bg-cyan-300/[.06]" : "border-white/[.07] bg-black/10 hover:border-white/[.12]"}`}><div className="flex items-center gap-3"><span className={`grid h-7 w-7 place-items-center rounded-lg text-[10px] font-bold ${step === index + 1 ? "bg-cyan-300 text-slate-950" : "bg-white/[.05] text-slate-500"}`}>{index + 1}</span><p className="text-xs font-semibold text-white">{item.title}</p></div><p className="mt-3 text-[10px] leading-5 text-slate-500">{item.detail}</p></button>)}</div>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-5 sm:p-6">
        {step === 1 ? <>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300">Step 1 of 3</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Where do your order emails arrive?</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">Choose the email service you personally open to read new-order messages. This is not asking which marketplace you sell on.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{(["gmail", "outlook"] as const).map((item) => <button key={item} type="button" onClick={() => setProvider(item)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${provider === item ? "border-cyan-300/25 bg-cyan-300/[.06]" : "border-white/[.07] bg-black/10"}`}><Mail className={`h-5 w-5 ${provider === item ? "text-cyan-300" : "text-slate-600"}`} /><div><p className="text-xs font-semibold text-white">{item === "gmail" ? "Gmail" : "Outlook / Microsoft"}</p><p className="mt-1 text-[9px] text-slate-600">I read my order emails here</p></div>{provider === item ? <Check className="ml-auto h-4 w-4 text-cyan-300" /> : null}</button>)}</div>
          <h3 className="mt-6 text-sm font-semibold text-white">Which orders should we look for first?</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">{emailMarketplaces.map((item) => <button key={item.id} type="button" onClick={() => setMarketplace(item.id)} className={`rounded-xl border px-3 py-3 text-xs font-semibold ${marketplace === item.id ? "border-cyan-300/25 bg-cyan-300/[.06] text-cyan-100" : "border-white/[.07] text-slate-500"}`}>{item.name}</button>)}</div>
          <button type="button" onClick={() => setStep(2)} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950">Show my {provider === "gmail" ? "Gmail" : "Outlook"} instructions <ArrowRight className="h-4 w-4" /></button>
        </> : null}

        {step === 2 ? <>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300">Step 2 of 3 · {provider === "gmail" ? "Gmail" : "Outlook"}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Follow these steps one at a time</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">Keep Trading Docks open in this tab. Open your email in a second tab, then return here after each step if you need help.</p>
          <div className="mt-5 space-y-3">{instructions.map((item, index) => <div key={item} className="flex gap-3 rounded-2xl border border-white/[.065] bg-black/10 p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-300/[.08] text-[10px] font-bold text-cyan-200">{index + 1}</span><p className="text-[11px] leading-5 text-slate-300">{item}</p></div>)}</div>
          <div className="mt-5 flex gap-2"><button type="button" onClick={() => setStep(1)} className="h-11 rounded-xl border border-white/[.08] px-4 text-xs font-semibold text-slate-400">Back</button><button type="button" onClick={() => setStep(3)} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 text-xs font-bold text-slate-950">I finished the email steps <ArrowRight className="h-4 w-4" /></button></div>
        </> : null}

        {step === 3 ? <>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-300">Step 3 of 3</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Verify your first forwarded order</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">After email receiving is activated, Trading Docks will wait for one {marketplaceName} message. We will show exactly what was recognized before any inventory is changed.</p>
          <div className={`mt-5 rounded-2xl border p-5 text-center ${importAddressStatus === "active" ? "border-emerald-300/14 bg-emerald-300/[.035]" : "border-amber-300/14 bg-amber-300/[.035]"}`}>
            {importAddressStatus === "active" ? <ShieldCheck className="mx-auto h-6 w-6 text-emerald-300" /> : <RefreshCw className="mx-auto h-6 w-6 text-amber-300" />}
            <p className={`mt-3 text-sm font-semibold ${importAddressStatus === "active" ? "text-emerald-100" : "text-amber-100"}`}>{importAddressStatus === "active" ? "Email receiving is active" : "Waiting for the first forwarded message"}</p>
            <p className={`mx-auto mt-2 max-w-md text-[10px] leading-5 ${importAddressStatus === "active" ? "text-emerald-100/55" : "text-amber-100/55"}`}>{importAddressStatus === "active" ? "Trading Docks can receive and process supported marketplace order emails. Use the button below to import any stored TCGplayer messages." : "Forward the verification message or a test message, then check again."}</p>
            <button type="button" disabled={emailProcessing} onClick={() => void checkAndImportOrders()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 to-blue-500 px-4 text-[10px] font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{emailProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{emailProcessing ? "Processing…" : "Check & import orders"}</button>
          </div>
          <button type="button" onClick={() => setStep(2)} className="mt-4 h-10 rounded-xl border border-white/[.08] px-4 text-xs font-semibold text-slate-400">Back to instructions</button>
        </> : null}
      </div>

      <aside className="space-y-4">
        <div className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-600">Your workspace’s private address</p>
          <div className="mt-3 flex gap-2"><input readOnly value={importAddress} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-white/[.08] bg-black/20 px-3 font-mono text-[10px] text-slate-300 outline-none" /><button type="button" onClick={() => void copyAddress()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-300/15 text-cyan-300 hover:bg-cyan-300/[.05]" aria-label="Copy private import address"><Copy className="h-4 w-4" /></button></div>
          <div className={`mt-3 flex items-start gap-2 rounded-xl border p-3 ${importAddressStatus === "active" ? "border-emerald-300/12 bg-emerald-300/[.03]" : "border-blue-300/12 bg-blue-300/[.03]"}`}>
            {importAddressStatus === "active" ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />}
            <p className={`text-[9px] leading-4 ${importAddressStatus === "active" ? "text-emerald-100/60" : "text-blue-100/60"}`}>
              <strong className={importAddressStatus === "active" ? "text-emerald-100" : "text-blue-100"}>
                {importAddressStatus === "active" ? "Permanent address active:" : "Permanent workspace address:"}
              </strong>{" "}
              This address is stored with the workspace and will not change unless an administrator explicitly rotates it.
            </p>
          </div>
        </div>
        <div className="rounded-[24px] border border-emerald-300/10 bg-emerald-300/[.025] p-5"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /><div><h3 className="text-sm font-semibold text-emerald-100">We do not open your inbox</h3><p className="mt-2 text-[11px] leading-5 text-emerald-100/55">You forward only marketplace order emails. Trading Docks never receives your Gmail or Outlook password and cannot read personal messages left in your mailbox.</p></div></div></div>
        <div className="rounded-[24px] border border-white/[.08] bg-[#07141e] p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-600">What happens to an order?</p><div className="mt-4 space-y-3">{[[Inbox, "Email arrives", "Only forwarded messages reach Trading Docks."], [MousePointerClick, "Order is recognized", "We extract the order number, items, quantity, and price."], [ShieldCheck, "You stay in control", "Uncertain cards go to review before inventory changes."]].map(([Icon, title, detail]) => { const StepIcon = Icon as typeof Inbox; return <div key={String(title)} className="flex gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-300/[.05]"><StepIcon className="h-4 w-4 text-cyan-300" /></div><div><p className="text-[11px] font-semibold text-slate-200">{String(title)}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{String(detail)}</p></div></div>; })}</div></div>
      </aside>
    </div>
  </section>;
}
