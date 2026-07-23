"use client";

import Link from "next/link";
import {
  Anchor,
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  CircleDollarSign,
  Compass,
  PackageSearch,
  Search,
  ShipWheel,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: Boxes,
    title: "Collection Management",
    description:
      "Organize cards by binder, box, condition, language, finish, and storage location.",
  },
  {
    icon: BarChart3,
    title: "Market Analytics",
    description:
      "Understand collection value, price movement, inventory aging, and profit performance.",
  },
  {
    icon: ShoppingCart,
    title: "Marketplace Operations",
    description:
      "Manage listings, purchases, sales, and marketplace activity from one workspace.",
  },
  {
    icon: PackageSearch,
    title: "Deal Finder",
    description:
      "Compare marketplace prices and surface inventory opportunities that match your targets.",
  },
];

const benefits = [
  "Track individual cards and sealed products",
  "Manage binders, boxes, shelves, and staged inventory",
  "Review sales, purchases, fees, and profit",
  "Connect marketplace tools as the platform grows",
];

const activity = [
  {
    title: "Inventory imported",
    detail: "248 cards added to Staging Box A",
    value: "+248",
  },
  {
    title: "Marketplace sale",
    detail: "Order recorded from TCGplayer",
    value: "$46.72",
  },
  {
    title: "Price movement",
    detail: "12 inventory items increased today",
    value: "+6.4%",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070a0f] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-0"
      >
        <div className="absolute left-1/2 top-[-18rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[130px]" />
        <div className="absolute right-[-14rem] top-[30rem] h-[32rem] w-[32rem] rounded-full bg-amber-400/8 blur-[130px]" />
        <div className="absolute bottom-[-20rem] left-[-10rem] h-[38rem] w-[38rem] rounded-full bg-teal-500/8 blur-[140px]" />
      </div>

      <div className="relative z-10">
        <header className="border-b border-white/8 bg-[#070a0f]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
            <Link
              href="/"
              className="flex items-center gap-3"
              aria-label="Trading Docks home"
            >
              <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
                <Anchor className="size-5 text-cyan-300" />
              </span>

              <span>
                <span className="block text-base font-semibold tracking-tight">
                  Trading Docks
                </span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
                  Collection Command Center
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex">
              <Link href="#features" className="transition hover:text-white">
                Features
              </Link>
              <Link href="#workspace" className="transition hover:text-white">
                Workspace
              </Link>
              <Link href="#about" className="transition hover:text-white">
                About
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                className="hidden text-white/70 hover:bg-white/6 hover:text-white sm:inline-flex"
              >
                <Link href="/login">Sign in</Link>
              </Button>

              <Button
                asChild
                className="bg-cyan-300 text-slate-950 shadow-[0_10px_35px_rgba(34,211,238,0.16)] hover:bg-cyan-200"
              >
                <Link href="/register">
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl items-center gap-16 px-5 pb-24 pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-32 lg:pt-28">
          <div>
            <Badge
              variant="outline"
              className="mb-6 border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-cyan-200"
            >
              <Sparkles className="size-3.5" />
              Built for collectors and sellers
            </Badge>

            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Your collection.
              <span className="block bg-gradient-to-r from-cyan-200 via-teal-300 to-amber-200 bg-clip-text text-transparent">
                Under control.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/58 sm:text-xl">
              Organize inventory, understand market value, manage sales, and
              find better opportunities from one professional MTG workspace.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 bg-cyan-300 px-6 text-slate-950 shadow-[0_14px_45px_rgba(34,211,238,0.18)] hover:-translate-y-0.5 hover:bg-cyan-200"
              >
                <Link href="/register">
                  Create your workspace
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/12 bg-white/3 px-6 text-white hover:-translate-y-0.5 hover:bg-white/7 hover:text-white"
              >
                <Link href="#workspace">
                  Explore the platform
                  <Compass className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/45">
              <span className="flex items-center gap-2">
                <Check className="size-4 text-teal-300" />
                Free during development
              </span>
              <span className="flex items-center gap-2">
                <Check className="size-4 text-teal-300" />
                Secure account data
              </span>
              <span className="flex items-center gap-2">
                <Check className="size-4 text-teal-300" />
                Built to scale
              </span>
            </div>
          </div>

          <DashboardPreview />
        </section>

        <section
          id="features"
          className="border-y border-white/8 bg-white/[0.018]"
        >
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                One connected platform
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything needed to run your collection
              </h2>
              <p className="mt-4 text-lg leading-8 text-white/52">
                Replace disconnected spreadsheets and repetitive workflows with
                a clear view of what you own, where it is, and how it performs.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <Card
                    key={feature.title}
                    className="group border-white/9 bg-white/[0.025] text-white shadow-none transition duration-300 hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-white/[0.045]"
                  >
                    <CardHeader>
                      <span className="mb-3 flex size-11 items-center justify-center rounded-xl border border-white/8 bg-white/5 transition group-hover:border-cyan-300/20 group-hover:bg-cyan-300/10">
                        <Icon className="size-5 text-cyan-200" />
                      </span>

                      <CardTitle>{feature.title}</CardTitle>
                      <CardDescription className="leading-6 text-white/48">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="workspace"
          className="mx-auto grid max-w-7xl gap-14 px-5 py-24 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-32"
        >
          <div>
            <Badge
              variant="outline"
              className="border-amber-300/20 bg-amber-300/8 text-amber-200"
            >
              Virtual HQ
            </Badge>

            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              A command center for every part of your operation
            </h2>

            <p className="mt-6 max-w-xl text-lg leading-8 text-white/52">
              Move between collection management, marketplace activity,
              finances, shipping, analytics, and deal discovery without losing
              sight of the bigger picture.
            </p>

            <div className="mt-8 space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-300/10">
                    <Check className="size-3.5 text-teal-300" />
                  </span>
                  <span className="text-white/68">{benefit}</span>
                </div>
              ))}
            </div>

            <Button
              asChild
              variant="link"
              className="mt-7 h-auto p-0 text-cyan-200 hover:text-cyan-100"
            >
              <Link href="/register">
                Build your Trading Docks account
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <WorkspaceCard
              icon={Boxes}
              title="Inventory"
              value="32,418"
              detail="Cards tracked"
            />
            <WorkspaceCard
              icon={CircleDollarSign}
              title="Finances"
              value="$8,462"
              detail="Monthly sales"
            />
            <WorkspaceCard
              icon={TrendingUp}
              title="Analytics"
              value="+14.8%"
              detail="Portfolio movement"
            />
            <WorkspaceCard
              icon={Search}
              title="Deal Finder"
              value="43"
              detail="Opportunities found"
            />
          </div>
        </section>

        <section id="about" className="px-5 pb-24 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-cyan-300/12 bg-gradient-to-br from-cyan-300/10 via-white/[0.035] to-amber-300/8 p-8 sm:p-12 lg:flex lg:items-center lg:justify-between lg:p-16">
            <div className="max-w-2xl">
              <ShipWheel className="size-9 text-cyan-200" />
              <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                Bring your entire collection into one workspace.
              </h2>
              <p className="mt-4 text-lg leading-8 text-white/55">
                Trading Docks is being built to make collection management
                clearer, marketplace operations faster, and financial decisions
                easier.
              </p>
            </div>

            <Button
              asChild
              size="lg"
              className="mt-8 h-12 bg-white px-6 text-slate-950 hover:bg-white/90 lg:mt-0"
            >
              <Link href="/register">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <footer className="border-t border-white/8">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-white/38 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="flex items-center gap-2">
              <Anchor className="size-4 text-cyan-300/70" />
              <span>© 2026 Trading Docks</span>
            </div>

            <p>Professional collection and inventory management.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}

function DashboardPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-5 rounded-[2rem] bg-cyan-400/7 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d121a]/95 shadow-[0_35px_100px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-400/70" />
            <span className="size-2.5 rounded-full bg-amber-300/70" />
            <span className="size-2.5 rounded-full bg-teal-300/70" />
          </div>

          <span className="text-xs font-medium text-white/35">
            Trading Docks Dashboard
          </span>
        </div>

        <div className="grid grid-cols-[68px_1fr]">
          <aside className="border-r border-white/8 p-3">
            <div className="flex flex-col items-center gap-3">
              {[Anchor, BarChart3, Boxes, ShoppingCart, Search].map(
                (Icon, index) => (
                  <span
                    key={index}
                    className={`flex size-10 items-center justify-center rounded-xl ${
                      index === 0
                        ? "bg-cyan-300/12 text-cyan-200"
                        : "text-white/30"
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                ),
              )}
            </div>
          </aside>

          <div className="min-w-0 p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-white/35">Welcome back</p>
                <p className="mt-1 font-semibold">Collection overview</p>
              </div>

              <Badge className="bg-teal-300/10 text-teal-200">
                Live workspace
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric
                label="Collection value"
                value="$184,231"
                change="+3.8%"
              />
              <Metric label="Inventory" value="32,418" change="+248" />
              <Metric label="Monthly profit" value="$2,418" change="+12.4%" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Portfolio performance</p>
                  <span className="text-xs text-white/30">Last 30 days</span>
                </div>

                <div className="mt-6 flex h-28 items-end gap-2">
                  {[34, 46, 40, 62, 55, 72, 67, 83, 76, 94, 88, 100].map(
                    (height, index) => (
                      <span
                        key={index}
                        className="min-w-0 flex-1 rounded-t-sm bg-gradient-to-t from-cyan-400/20 to-cyan-300/80"
                        style={{ height: `${height}%` }}
                      />
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <p className="text-sm font-medium">Recent activity</p>

                <div className="mt-4 space-y-4">
                  {activity.map((item) => (
                    <div
                      key={item.title}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-white/75">
                          {item.title}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-white/30">
                          {item.detail}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs font-medium text-teal-200">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/30">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-lg font-semibold tracking-tight">{value}</p>
        <span className="text-[10px] font-medium text-teal-200">{change}</span>
      </div>
    </div>
  );
}

function WorkspaceCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Boxes;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-white/9 bg-white/[0.025] text-white shadow-none transition duration-300 hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-white/[0.045]">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/5">
            <Icon className="size-5 text-cyan-200" />
          </span>
          <ArrowRight className="size-4 text-white/20" />
        </div>

        <p className="mt-8 text-sm text-white/45">{title}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-white/30">{detail}</p>
      </CardContent>
    </Card>
  );
}