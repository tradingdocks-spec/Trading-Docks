import {
  Boxes,
  CircleDollarSign,
  FileUp,
  Network,
  PackageCheck,
  ShoppingCart,
  Tags,
  TrendingUp,
  Workflow,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Experience", href: "#experience" },
  { label: "Platform", href: "#platform" },
  { label: "Plans", href: "#plans" },
  { label: "Market", href: "#market" },
  { label: "Automation", href: "#automation" },
  { label: "Pricing", href: "#pricing" },
];

export const SUPPORTED_GAMES = [
  { label: "Magic: The Gathering", short: "MTG" },
  { label: "Pokémon", short: "PKM" },
  { label: "Lorcana", short: "LOR" },
  { label: "One Piece", short: "OP" },
  { label: "Yu-Gi-Oh!", short: "YGO" },
];

export type LandingDemoPersona = "collector" | "seller" | "store";

export type LandingDemoActivity = {
  label: string;
  value: string;
  detail: string;
};

export type LandingDemoWorkspace = {
  persona: LandingDemoPersona;
  selectorLabel: string;
  plan: "Collector" | "Seller" | "Store";
  disclosure: string;
  statusLabel: string;
  tagline: string;
  connectedSystems: string[];
  nav: string[];
  metricLabels: string[];
  metricValues: string[];
  metricDetails: string[];
  syncedValues: string[];
  syncedDetails: string[];
  activity: LandingDemoActivity[];
  syncedActivity: LandingDemoActivity[];
  chartShape: number[];
  floatingStatuses: {
    inventory: LandingDemoActivity;
    listings: LandingDemoActivity;
    market: LandingDemoActivity;
  };
};

export const LANDING_DEMO_WORKSPACES: Record<LandingDemoPersona, LandingDemoWorkspace> = {
  collector: {
    persona: "collector",
    selectorLabel: "I'm a collector",
    plan: "Collector",
    disclosure: "Demo workspace",
    statusLabel: "Snapshot preview",
    tagline: "Understand the value, location, and trade potential of a focused personal collection.",
    connectedSystems: ["Scanner", "Deck Vault", "Binder"],
    nav: ["Home", "Collection", "Deck Vault", "Trade Binder", "Wishlist"],
    metricLabels: ["Collection value", "Owned cards", "Saved decks", "30-day move"],
    metricValues: ["$8,740", "1,186", "14", "+2.6%"],
    metricDetails: ["25 cards missing market price", "912 unique printings", "4 decks updated this week", "Two high-value cards dipped"],
    syncedValues: ["$8,812", "1,193", "14", "+2.8%"],
    syncedDetails: ["Wishlist matches refreshed", "7 cards added from scanner", "Commander deck unchanged", "Market snapshot at 11:18 AM"],
    activity: [
      { label: "Binder location updated", value: "12 cards", detail: "Deck box A assigned · 9:46 AM" },
      { label: "Wishlist match found", value: "2 copies", detail: "Local binder candidate · 10:08 AM" },
      { label: "Deck value refreshed", value: "-$6.18", detail: "Atraxa list moved slightly lower · 10:42 AM" },
    ],
    syncedActivity: [
      { label: "Scanner queue synced", value: "7 cards", detail: "Collection updated · just now" },
      { label: "Storage audit complete", value: "18 unassigned", detail: "Binder locations checked · just now" },
      { label: "Market snapshot saved", value: "$8,812", detail: "Collector view refreshed · just now" },
    ],
    chartShape: [28, 33, 31, 39, 42, 48, 45, 53, 57, 55, 61, 66],
    floatingStatuses: {
      inventory: { label: "Collection scanned", value: "+7 cards", detail: "Scanner queue synced · 11:18 AM" },
      listings: { label: "Storage assigned", value: "84%", detail: "18 cards still unassigned" },
      market: { label: "Price movement", value: "-0.7%", detail: "Reserved List watchlist · 24h" },
    },
  },
  seller: {
    persona: "seller",
    selectorLabel: "I sell online",
    plan: "Seller",
    disclosure: "Example seller account",
    statusLabel: "Sample seller data",
    tagline: "Turn purchasing, listing, repricing, and fulfillment into one weekly operating rhythm.",
    connectedSystems: ["TCGplayer", "eBay", "Mana Pool"],
    nav: ["Dashboard", "Inventory", "Deal Desk", "Orders", "CSV Engine"],
    metricLabels: ["Inventory value", "Active listings", "Open orders", "7-day profit"],
    metricValues: ["$42,680", "3,214", "17", "$1,184"],
    metricDetails: ["412 singles not listed yet", "62 repriced today", "11 TCGplayer · 6 eBay", "After fees and COGS"],
    syncedValues: ["$42,910", "3,276", "19", "$1,231"],
    syncedDetails: ["128 items updated", "62 listings repriced", "2 orders imported", "Forecast moved +$47"],
    activity: [
      { label: "TCGplayer order imported", value: "$74.36", detail: "2 min ago · 3 cards ready to pick" },
      { label: "Listings repriced", value: "62", detail: "11:20 AM · floor rules respected" },
      { label: "Buylist opportunity detected", value: "+18% margin", detail: "Retro frame singles · 10:58 AM" },
    ],
    syncedActivity: [
      { label: "Inventory sync complete", value: "128 items", detail: "Mana Pool finished · just now" },
      { label: "eBay orders imported", value: "2", detail: "Fulfillment queue updated · just now" },
      { label: "Profit forecast updated", value: "+$47", detail: "Fees reconciled · just now" },
    ],
    chartShape: [35, 42, 39, 48, 46, 58, 54, 63, 61, 70, 67, 75],
    floatingStatuses: {
      inventory: { label: "Inventory sync complete", value: "128 items", detail: "Mana Pool finished · 11:20 AM" },
      listings: { label: "Listings repriced", value: "62 today", detail: "3,276 active listings" },
      market: { label: "Buylist spread", value: "+18%", detail: "Retro frame batch · 10:58 AM" },
    },
  },
  store: {
    persona: "store",
    selectorLabel: "I own a store",
    plan: "Store",
    disclosure: "Sample store data",
    statusLabel: "Store snapshot preview",
    tagline: "Coordinate inventory, staff, vendors, events, and multi-channel selling from one operating workspace.",
    connectedSystems: ["TCGplayer", "eBay", "POS", "Card Shows"],
    nav: ["Command Center", "Inventory", "Employees", "Card Shows", "Vendors"],
    metricLabels: ["Weekly revenue", "Inventory units", "Staff tasks", "Open orders"],
    metricValues: ["$18,420", "27,840", "9", "43"],
    metricDetails: ["POS + marketplace sales", "4,920 sealed units", "5 assigned to staff", "31 paid · 12 review"],
    syncedValues: ["$18,736", "27,968", "7", "46"],
    syncedDetails: ["Show sales posted", "128 items received", "2 tasks closed", "3 marketplace orders imported"],
    activity: [
      { label: "POS sales posted", value: "$1,284", detail: "10:52 AM · singles counter" },
      { label: "Vendor restock received", value: "128 items", detail: "11:06 AM · sealed inventory" },
      { label: "Card show labels printed", value: "86 labels", detail: "11:14 AM · table case B" },
    ],
    syncedActivity: [
      { label: "Store inventory reconciled", value: "128 items", detail: "Receiving batch closed · just now" },
      { label: "Staff queue updated", value: "7 tasks", detail: "Two tasks completed · just now" },
      { label: "Marketplace orders imported", value: "3 orders", detail: "Fulfillment queue updated · just now" },
    ],
    chartShape: [44, 41, 49, 52, 48, 57, 63, 60, 68, 72, 70, 78],
    floatingStatuses: {
      inventory: { label: "Receiving posted", value: "128 items", detail: "Vendor batch closed · 11:06 AM" },
      listings: { label: "Open orders", value: "46", detail: "31 paid · 12 review · 3 imported" },
      market: { label: "Show labels printed", value: "86 labels", detail: "Card show table case B" },
    },
  },
};

export const HERO_DEMO_WORKSPACE = LANDING_DEMO_WORKSPACES.seller;

export const MARKET_ITEMS = [
  {
    name: "Cavern of Souls",
    set: "Lost Caverns of Ixalan",
    image:
      "https://cards.scryfall.io/small/front/4/9/49dbdabc-9b82-476d-8efc-63d33f1f13ab.jpg",
    price: "$47.80",
    change: "+1.34%",
    direction: "up" as const,
    points: [44, 45, 44, 46, 47, 46, 48, 49, 48, 50],
  },
  {
    name: "Rhystic Study",
    set: "Wilds of Eldraine",
    image:
      "https://cards.scryfall.io/small/front/8/9/89dc5f8a-3844-4fb5-b8ec-cd585466f231.jpg",
    price: "$31.25",
    change: "-0.82%",
    direction: "down" as const,
    points: [33, 34, 33, 32, 33, 32, 31, 31, 30, 31],
  },
  {
    name: "The One Ring",
    set: "Tales of Middle-earth",
    image:
      "https://cards.scryfall.io/small/front/4/5/4536e6da-4b9d-4d67-a3fb-b3f1e3e1d664.jpg",
    price: "$82.40",
    change: "+0.46%",
    direction: "up" as const,
    points: [79, 80, 81, 81, 82, 81, 82, 83, 82, 82],
  },
  {
    name: "Sheoldred, the Apocalypse",
    set: "Dominaria United",
    image:
      "https://cards.scryfall.io/small/front/6/8/68e0f9d9-3f20-4b58-92aa-83b0060bc668.jpg",
    price: "$63.10",
    change: "-1.18%",
    direction: "down" as const,
    points: [66, 65, 64, 64, 63, 62, 63, 62, 61, 61],
  },
];

export const FEATURES = [
  {
    title: "Inventory OS",
    description:
      "Track condition, language, quantity, location, cost basis, and live value across your entire catalog.",
    stat: "Exact locations",
    icon: Boxes,
  },
  {
    title: "Marketplace command",
    description:
      "Synchronize listings, orders, and available quantities across every connected sales channel.",
    stat: "Multi-channel",
    icon: Network,
  },
  {
    title: "Market intelligence",
    description:
      "Surface price movement, aging inventory, demand shifts, and emerging opportunities.",
    stat: "Live signals",
    icon: TrendingUp,
  },
  {
    title: "Order operations",
    description:
      "Manage orders, fulfillment, fees, customer activity, and payout status in one place.",
    stat: "Pick to payout",
    icon: ShoppingCart,
  },
  {
    title: "Automation engine",
    description:
      "Automate imports, repricing, listing, synchronization, and operational review queues.",
    stat: "Rule-driven",
    icon: Workflow,
  },
  {
    title: "Financial visibility",
    description:
      "Understand revenue, expenses, margins, inventory value, payouts, and channel performance.",
    stat: "True margins",
    icon: CircleDollarSign,
  },
];

export const AUTOMATION_CARDS = [
  {
    icon: FileUp,
    title: "Import and normalize",
    description:
      "Bring in catalog data from scanners, CSVs, marketplaces, and APIs, then standardize it automatically.",
  },
  {
    icon: Tags,
    title: "List and reprice",
    description:
      "Publish inventory and keep prices aligned with your own rules, floors, and market changes.",
  },
  {
    icon: PackageCheck,
    title: "Route and fulfill",
    description:
      "Turn new orders into organized pick, pack, label, and shipping workflows.",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "Keep every copy traceable—from its purchase and condition to its binder, listing, sale, and payout.",
    name: "Traceable inventory",
    role: "Designed for collections of every size",
  },
  {
    quote:
      "Give collectors a focused personal workspace while sellers and stores unlock the operations they actually need.",
    name: "Plan-aware workspace",
    role: "Free, Collector, Seller, and Store",
  },
  {
    quote:
      "Turn pricing, purchasing, fulfillment, and reporting into one connected workflow instead of scattered tools.",
    name: "Connected operations",
    role: "Built around real card-business workflows",
  },
];
