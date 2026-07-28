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
  { label: "Platform", href: "#platform" },
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

export const MARKET_ITEMS = [
  {
    name: "Mana Crypt",
    set: "Kaladesh Inventions",
    image:
      "https://cards.scryfall.io/small/front/4/9/49dbdabc-9b82-476d-8efc-63d33f1f13ab.jpg",
    price: "$477.42",
    change: "+8.42%",
    direction: "up" as const,
    points: [22, 28, 25, 37, 33, 49, 44, 60, 55, 74],
  },
  {
    name: "Force of Will",
    set: "Alliances",
    image:
      "https://cards.scryfall.io/small/front/8/9/89dc5f8a-3844-4fb5-b8ec-cd585466f231.jpg",
    price: "$72.51",
    change: "+6.91%",
    direction: "up" as const,
    points: [23, 30, 27, 39, 35, 43, 41, 53, 49, 64],
  },
  {
    name: "The One Ring",
    set: "The Lord of the Rings",
    image:
      "https://cards.scryfall.io/small/front/4/5/4536e6da-4b9d-4d67-a3fb-b3f1e3e1d664.jpg",
    price: "$89.74",
    change: "+5.78%",
    direction: "up" as const,
    points: [20, 23, 29, 26, 40, 35, 47, 43, 56, 66],
  },
  {
    name: "Underground Sea",
    set: "Revised Edition",
    image:
      "https://cards.scryfall.io/small/front/6/8/68e0f9d9-3f20-4b58-92aa-83b0060bc668.jpg",
    price: "$799.00",
    change: "-2.10%",
    direction: "down" as const,
    points: [66, 62, 64, 56, 58, 49, 52, 44, 47, 39],
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
