"use client";

import Link from "next/link";
import type { CSSProperties, LucideIcon, ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  Layers3,
  Network,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Workflow,
  Zap,
} from "lucide-react";

const performanceBars = [
  32, 43, 38, 51, 47, 62, 55, 69, 63, 78, 72, 91,
];

const chartPoints = [
  { x: 0, y: 73 },
  { x: 9, y: 64 },
  { x: 18, y: 67 },
  { x: 27, y: 52 },
  { x: 36, y: 61 },
  { x: 45, y: 49 },
  { x: 54, y: 54 },
  { x: 63, y: 34 },
  { x: 72, y: 42 },
  { x: 81, y: 27 },
  { x: 90, y: 35 },
  { x: 100, y: 16 },
];

const chartPath = chartPoints
  .map(
    (point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
  )
  .join(" ");

const headlineFeatures = [
  {
    title: "Inventory",
    description: "Track every card with precision",
    icon: Boxes,
  },
  {
    title: "Trading",
    description: "Buy, sell, and trade confidently",
    icon: ShoppingCart,
  },
  {
    title: "Analytics",
    description: "Turn market data into decisions",
    icon: BarChart3,
  },
  {
    title: "Secure",
    description: "Professional protection for your data",
    icon: ShieldCheck,
  },
  {
    title: "Fast",
    description: "Built for speed and performance",
    icon: Zap,
  },
];

const platformFeatures = [
  {
    title: "Smart Inventory",
    description:
      "Manage card conditions, quantities, sets, costs, and storage locations from one workspace.",
    icon: Boxes,
    status: "32,418 cards",
  },
  {
    title: "Market Analytics",
    description:
      "Monitor pricing trends, demand, inventory age, and opportunities across your catalog.",
    icon: TrendingUp,
    status: "+12.7% growth",
  },
  {
    title: "Sales Management",
    description:
      "Organize listings, incoming orders, fulfillment, fees, and customer activity.",
    icon: ShoppingCart,
    status: "38 orders today",
  },
  {
    title: "Automation",
    description:
      "Create intelligent workflows for pricing, synchronization, listing, and fulfillment.",
    icon: Workflow,
    status: "12 active flows",
  },
  {
    title: "Integrations",
    description:
      "Connect marketplaces and keep inventory availability synchronized everywhere.",
    icon: Network,
    status: "5 connected",
  },
  {
    title: "Cloud Security",
    description:
      "Protect your inventory and business data with modern cloud infrastructure.",
    icon: ShieldCheck,
    status: "Protected",
  },
];

export default function HomePage() {
  return (
    <main className="landing-page relative min-h-screen overflow-hidden bg-[#02080d] text-white">
      <AmbientBackground />

      <header className="relative z-50 border-b border-white/[0.055] bg-[#02080d]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-[76px] w-full max-w-[1450px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <BrandLogo />

          <nav className="hidden items-center gap-10 lg:flex">
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#platform">Platform</NavLink>
            <NavLink href="#workflow">How it works</NavLink>
            <NavLink href="#security">Security</NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="hidden h-10 items-center rounded-xl px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>

            <Link
              href="/sign-up"
              className="primary-button group relative inline-flex h-11 items-center gap-3 overflow-hidden rounded-2xl px-5 text-sm font-semibold text-[#021016]"
            >
              <span className="relative z-10">Get started</span>

              <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10">
        <div className="mx-auto grid w-full max-w-[1450px] gap-14 px-5 pb-16 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,0.86fr)_minmax(590px,1.14fr)] lg:items-center lg:px-12 lg:pb-20 lg:pt-20">
          <div className="relative max-w-[650px]">
            <div className="hero-copy">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/[0.055] px-4 py-2 text-xs font-medium text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.06)]">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Built for serious collectors and sellers
              </div>

              <h1 className="mt-7 font-serif text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-[74px]">
                Your collection.

                <span className="mt-2 block bg-gradient-to-r from-cyan-100 via-cyan-300 to-sky-500 bg-clip-text text-transparent">
                  Under control.
                </span>
              </h1>

              <p className="mt-7 max-w-[620px] text-base leading-8 text-slate-400 sm:text-lg">
                Organize inventory, track market value, manage sales,
                and discover better opportunities from one professional
                trading-card command center.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="primary-button group relative inline-flex h-[54px] items-center justify-center gap-3 overflow-hidden rounded-2xl px-7 text-sm font-semibold text-[#021016]"
                >
                  <span className="relative z-10">
                    Create your workspace
                  </span>

                  <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>

                <a
                  href="#platform"
                  className="secondary-button group inline-flex h-[54px] items-center justify-center gap-3 rounded-2xl px-7 text-sm font-semibold text-white"
                >
                  Explore the platform

                  <Search className="h-4 w-4 text-slate-500 transition duration-300 group-hover:text-cyan-300" />
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
                <Benefit text="Free during development" />
                <Benefit text="Secure account data" />
                <Benefit text="Built to scale" />
              </div>
            </div>
          </div>

          <DashboardPreview />
        </div>

        <div
          id="features"
          className="mx-auto w-full max-w-[1450px] px-5 sm:px-8 lg:px-12"
        >
          <div className="feature-strip relative overflow-hidden rounded-[27px] border border-white/[0.09] bg-[#07131c]/80 px-5 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:px-7">
            <div className="absolute inset-x-24 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />

            <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {headlineFeatures.map((feature, index) => (
                <HeadlineFeature
                  key={feature.title}
                  feature={feature}
                  hasDivider={index !== headlineFeatures.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="relative z-10 mx-auto grid w-full max-w-[1450px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-12 lg:py-32"
      >
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            All-in-one platform
          </p>

          <h2 className="mt-4 max-w-lg text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Everything you need in one powerful platform.
          </h2>

          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
            Trading Docks replaces scattered spreadsheets and
            marketplace tabs with one organized operating system
            designed for trading-card businesses.
          </p>

          <div className="mt-8 space-y-4">
            <BenefitRow text="Real-time inventory synchronization" />
            <BenefitRow text="Advanced analytics and insights" />
            <BenefitRow text="Marketplace integrations" />
            <BenefitRow text="Automated operational workflows" />
            <BenefitRow text="Secure cloud infrastructure" />
          </div>

          <Link
            href="/dashboard"
            className="mt-9 inline-flex h-11 items-center gap-3 rounded-xl border border-cyan-300/25 bg-cyan-400/[0.055] px-5 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-400/[0.1] hover:shadow-[0_0_30px_rgba(34,211,238,0.08)]"
          >
            See all features
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {platformFeatures.map((feature, index) => (
            <PlatformCard
              key={feature.title}
              feature={feature}
              index={index}
            />
          ))}
        </div>
      </section>

      <section
        id="workflow"
        className="relative z-10 border-y border-white/[0.055] bg-white/[0.012]"
      >
        <div className="mx-auto w-full max-w-[1450px] px-5 py-24 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              One connected workflow
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              From inventory acquisition to fulfillment.
            </h2>

            <p className="mt-5 text-base leading-7 text-slate-400">
              Every step of your trading-card operation stays
              organized, connected, and visible.
            </p>
          </div>

          <div className="relative mt-16 grid gap-5 lg:grid-cols-4">
            <WorkflowCard
              number="01"
              title="Import inventory"
              description="Add products through scanning, CSV uploads, APIs, or connected marketplaces."
              icon={Boxes}
            />

            <WorkflowCard
              number="02"
              title="Organize products"
              description="Assign conditions, languages, costs, quantities, and physical storage locations."
              icon={Layers3}
            />

            <WorkflowCard
              number="03"
              title="List and sell"
              description="Publish products and synchronize available quantities across connected stores."
              icon={Store}
            />

            <WorkflowCard
              number="04"
              title="Analyze results"
              description="Review revenue, fees, demand, profit, inventory age, and pricing opportunities."
              icon={BarChart3}
            />
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1450px] px-5 py-24 sm:px-8 lg:px-12">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Works seamlessly with
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <MarketplaceBadge label="TCGPLAYER" />
            <MarketplaceBadge label="eBay" />
            <MarketplaceBadge label="MANA POOL" />
            <MarketplaceBadge label="Shopify" />
            <MarketplaceBadge label="Cardmarket" />
            <MarketplaceBadge label="and more" muted />
          </div>
        </div>
      </section>

      <section
        id="security"
        className="relative z-10 mx-auto w-full max-w-[1450px] px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32"
      >
        <div className="final-cta relative overflow-hidden rounded-[32px] border border-cyan-300/[0.18] bg-[#06111b] px-6 py-12 shadow-[0_35px_120px_rgba(0,0,0,0.42)] sm:px-10 lg:px-14 lg:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_50%,rgba(34,211,238,0.1),transparent_32%),radial-gradient(circle_at_92%_20%,rgba(139,92,246,0.09),transparent_34%)]" />

          <div className="absolute inset-x-24 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />

          <div className="relative grid gap-12 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Ready to take control?
              </p>

              <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Build the command center for your card business.
              </h2>

              <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
                Start organizing inventory, connecting marketplaces,
                and automating your operation today.
              </p>

              <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
                <Benefit text="Free during development" />
                <Benefit text="Cancel anytime" />
                <Benefit text="Secure workspace" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-8 lg:items-end">
              <FloatingLogo />

              <Link
                href="/sign-up"
                className="primary-button group relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-2xl px-7 text-sm font-semibold text-[#021016]"
              >
                <span className="relative z-10">
                  Get started for free
                </span>

                <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.055]">
        <div className="mx-auto flex w-full max-w-[1450px] flex-col gap-5 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <BrandLogo compact />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-600">
            <span>© 2026 Trading Docks</span>
            <a href="#" className="transition hover:text-slate-300">
              Privacy
            </a>
            <a href="#" className="transition hover:text-slate-300">
              Terms
            </a>
            <a href="#" className="transition hover:text-slate-300">
              Security
            </a>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        body {
          background: #02080d;
        }

        @keyframes hero-enter {
          from {
            opacity: 0;
            transform: translateY(22px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes dashboard-float {
          0%,
          100% {
            transform: perspective(1400px) rotateX(0.8deg)
              rotateY(-1.8deg) translateY(0);
          }

          50% {
            transform: perspective(1400px) rotateX(0deg)
              rotateY(-0.8deg) translateY(-9px);
          }
        }

        @keyframes orbit-clockwise {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes orbit-counter {
          from {
            transform: rotate(360deg);
          }

          to {
            transform: rotate(0deg);
          }
        }

        @keyframes chart-line-draw {
          from {
            stroke-dashoffset: 430;
          }

          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes chart-bar-rise {
          from {
            transform: scaleY(0);
            opacity: 0;
          }

          to {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        @keyframes soft-pulse {
          0%,
          100% {
            opacity: 0.4;
            transform: scale(0.97);
          }

          50% {
            opacity: 0.68;
            transform: scale(1.03);
          }
        }

        @keyframes logo-float {
          0%,
          100% {
            transform: translateY(0) rotate(-4deg);
          }

          50% {
            transform: translateY(-9px) rotate(1deg);
          }
        }

        @keyframes button-shine {
          0%,
          72% {
            transform: translateX(-180%) skewX(-18deg);
          }

          100% {
            transform: translateX(320%) skewX(-18deg);
          }
        }

        .hero-copy {
          animation: hero-enter 700ms ease-out both;
        }

        .dashboard-preview {
          animation: dashboard-float 7s ease-in-out infinite;
          transform-style: preserve-3d;
        }

        .orbit-clockwise {
          animation: orbit-clockwise 22s linear infinite;
        }

        .orbit-counter {
          animation: orbit-counter 28s linear infinite;
        }

        .ambient-pulse {
          animation: soft-pulse 6s ease-in-out infinite;
        }

        .floating-logo {
          animation: logo-float 5.5s ease-in-out infinite;
        }

        .chart-path {
          stroke-dasharray: 430;
          stroke-dashoffset: 430;
          animation: chart-line-draw 2.2s ease-out 350ms forwards;
        }

        .chart-column {
          transform-box: fill-box;
          transform-origin: bottom;
          animation: chart-bar-rise 850ms
            cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .primary-button {
          border: 1px solid rgba(165, 243, 252, 0.45);
          background: linear-gradient(
            110deg,
            rgb(103, 232, 249),
            rgb(34, 211, 238) 45%,
            rgb(14, 165, 233)
          );
          box-shadow:
            0 16px 50px rgba(34, 211, 238, 0.19),
            inset 0 1px rgba(255, 255, 255, 0.65);
          transition:
            transform 300ms ease,
            box-shadow 300ms ease,
            filter 300ms ease;
        }

        .primary-button::after {
          position: absolute;
          top: -40%;
          bottom: -40%;
          left: 0;
          width: 25%;
          content: "";
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.46),
            transparent
          );
          filter: blur(2px);
          animation: button-shine 5s ease-in-out infinite;
        }

        .primary-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.04);
          box-shadow:
            0 22px 70px rgba(34, 211, 238, 0.28),
            0 0 30px rgba(34, 211, 238, 0.12),
            inset 0 1px rgba(255, 255, 255, 0.75);
        }

        .secondary-button {
          border: 1px solid rgba(255, 255, 255, 0.11);
          background: rgba(255, 255, 255, 0.025);
          box-shadow: inset 0 1px rgba(255, 255, 255, 0.025);
          backdrop-filter: blur(18px);
          transition:
            transform 300ms ease,
            border-color 300ms ease,
            background 300ms ease,
            box-shadow 300ms ease;
        }

        .secondary-button:hover {
          transform: translateY(-2px);
          border-color: rgba(103, 232, 249, 0.25);
          background: rgba(103, 232, 249, 0.045);
          box-shadow: 0 0 30px rgba(34, 211, 238, 0.06);
        }

        .feature-strip {
          transition:
            border-color 400ms ease,
            box-shadow 400ms ease;
        }

        .feature-strip:hover {
          border-color: rgba(103, 232, 249, 0.16);
          box-shadow:
            0 32px 100px rgba(0, 0, 0, 0.38),
            0 0 40px rgba(34, 211, 238, 0.035);
        }

        .final-cta {
          transition:
            border-color 400ms ease,
            box-shadow 400ms ease;
        }

        .final-cta:hover {
          border-color: rgba(103, 232, 249, 0.3);
          box-shadow:
            0 40px 130px rgba(0, 0, 0, 0.5),
            0 0 45px rgba(34, 211, 238, 0.06);
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </main>
  );
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(6,182,212,0.065),transparent_28%),radial-gradient(circle_at_80%_32%,rgba(14,165,233,0.06),transparent_31%),radial-gradient(circle_at_58%_100%,rgba(124,58,237,0.045),transparent_34%)]" />

      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
          maskImage:
            "linear-gradient(to bottom, black, transparent 76%)",
        }}
      />

      <div className="ambient-pulse absolute left-[13%] top-24 h-[390px] w-[390px] rounded-full bg-cyan-400/[0.035] blur-[150px]" />

      <div className="absolute right-[-7%] top-[18%] h-[480px] w-[480px] rounded-full bg-blue-500/[0.04] blur-[170px]" />

      <div className="absolute left-[5%] top-[20%] h-1 w-1 rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(165,243,252,0.85)]" />

      <div className="absolute right-[9%] top-[24%] h-1 w-1 rounded-full bg-sky-200 shadow-[0_0_14px_rgba(186,230,253,0.85)]" />

      <div className="absolute right-[15%] top-[48%] h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.8)]" />
    </div>
  );
}

function BrandLogo({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <div
        className={[
          "relative flex items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-400/[0.06] shadow-[0_0_24px_rgba(34,211,238,0.09)] transition duration-300 group-hover:border-cyan-300/55 group-hover:shadow-[0_0_32px_rgba(34,211,238,0.16)]",
          compact ? "h-9 w-9" : "h-11 w-11",
        ].join(" ")}
      >
        <div className="absolute -right-1 -top-1 h-full w-full rotate-6 rounded-xl border border-sky-400/25" />

        <span
          className={[
            "relative z-10 font-semibold tracking-[-0.1em]",
            compact ? "text-sm" : "text-lg",
          ].join(" ")}
        >
          T<span className="text-cyan-300">D</span>
        </span>
      </div>

      <div>
        <p
          className={[
            "font-semibold uppercase tracking-[0.2em]",
            compact ? "text-xs" : "text-sm",
          ].join(" ")}
        >
          Trading
        </p>

        <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.5em] text-cyan-400">
          Docks
        </p>
      </div>
    </Link>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="relative text-sm font-medium text-slate-300 transition duration-300 hover:text-white after:absolute after:-bottom-2 after:left-0 after:h-px after:w-0 after:bg-cyan-300 after:transition-all after:duration-300 hover:after:w-full"
    >
      {children}
    </a>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <Check className="h-3.5 w-3.5 text-cyan-300" />
      {text}
    </div>
  );
}

function BenefitRow({ text }: { text: string }) {
  return (
    <div className="group flex items-center gap-3 text-sm text-slate-300">
      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/[0.07] transition duration-300 group-hover:border-cyan-300/40 group-hover:bg-cyan-400/[0.12] group-hover:shadow-[0_0_16px_rgba(34,211,238,0.12)]">
        <Check className="h-3 w-3 text-cyan-300" />
      </div>

      {text}
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[720px] py-7 lg:py-10">
      <div className="ambient-pulse absolute left-[8%] top-[15%] h-[70%] w-[84%] rounded-full bg-cyan-400/[0.07] blur-[110px]" />

      <div className="absolute right-[4%] top-[18%] h-40 w-40 rounded-full bg-violet-500/[0.065] blur-[90px]" />

      <div className="orbit-clockwise absolute inset-[7%] rounded-[50%] border border-cyan-400/15" />

      <div className="orbit-counter absolute inset-[14%] rounded-[50%] border border-violet-400/12" />

      <div className="dashboard-preview relative">
        <div className="absolute -right-1 top-3 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_14px_4px_rgba(125,211,252,0.6),0_0_35px_10px_rgba(59,130,246,0.22)]" />

        <div className="group relative overflow-hidden rounded-[28px] border border-cyan-200/[0.19] bg-[#06121b]/96 shadow-[0_38px_120px_rgba(0,0,0,0.56),0_0_65px_rgba(34,211,238,0.055)] backdrop-blur-2xl transition duration-500 hover:border-cyan-200/[0.3] hover:shadow-[0_42px_130px_rgba(0,0,0,0.64),0_0_75px_rgba(34,211,238,0.1)]">
          <div className="absolute inset-x-20 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/75 to-transparent" />

          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.045] blur-[85px] transition duration-500 group-hover:bg-cyan-300/[0.075]" />

          <div className="flex h-12 items-center justify-between border-b border-white/[0.065] px-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </div>

            <p className="text-[10px] text-slate-600">
              Trading Docks Dashboard
            </p>
          </div>

          <div className="grid min-h-[438px] grid-cols-[66px_minmax(0,1fr)]">
            <DashboardSidebar />

            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] text-slate-600">
                    Welcome back, Jeremy
                  </p>

                  <h3 className="mt-1 text-lg font-semibold tracking-tight">
                    Collection overview
                  </h3>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-emerald-300/[0.14] bg-emerald-400/[0.07] px-3 py-1.5 text-[9px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_9px_rgba(110,231,183,0.8)]" />
                  Live workspace
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <DashboardMetric
                  label="Collection Value"
                  value="$184,231"
                  trend="+3.8%"
                />

                <DashboardMetric
                  label="Inventory"
                  value="32,418"
                  trend="+248"
                />

                <DashboardMetric
                  label="Monthly Profit"
                  value="$2,418"
                  trend="+12.4%"
                />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(170px,0.75fr)]">
                <PortfolioChart />
                <RecentActivity />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSidebar() {
  const sidebarIcons = [
    Layers3,
    BarChart3,
    Network,
    ShoppingCart,
    Search,
  ];

  return (
    <aside className="border-r border-white/[0.06] bg-black/[0.08] px-3 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/[0.07] text-xs font-semibold shadow-[0_0_20px_rgba(34,211,238,0.05)]">
        T<span className="text-cyan-300">D</span>
      </div>

      <div className="mt-5 space-y-3">
        {sidebarIcons.map((Icon, index) => (
          <div
            key={`${Icon.displayName ?? "icon"}-${index}`}
            className={[
              "flex h-10 w-10 items-center justify-center rounded-xl border transition duration-300",
              index === 1
                ? "border-cyan-300/20 bg-cyan-400/[0.09] text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.08)]"
                : "border-transparent text-slate-600 hover:border-white/[0.06] hover:bg-white/[0.025] hover:text-slate-300",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
          </div>
        ))}
      </div>
    </aside>
  );
}

function DashboardMetric({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.075] bg-white/[0.025] px-4 py-4 shadow-[inset_0_1px_rgba(255,255,255,0.02)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/[0.17] hover:bg-cyan-400/[0.035] hover:shadow-[0_12px_30px_rgba(0,0,0,0.18),0_0_20px_rgba(34,211,238,0.04)]">
      <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-slate-600 transition group-hover:text-slate-500">
        {label}
      </p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-base font-semibold tracking-tight">
          {value}
        </p>

        <span className="text-[9px] font-semibold text-emerald-300">
          {trend}
        </span>
      </div>
    </div>
  );
}

function PortfolioChart() {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.075] bg-white/[0.022] p-4 transition duration-300 hover:border-cyan-300/[0.16] hover:bg-cyan-400/[0.025]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold">
          Portfolio performance
        </p>

        <button
          type="button"
          className="flex items-center gap-1 text-[9px] text-slate-600 transition hover:text-slate-300"
        >
          Last 30 days
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div className="relative mt-4 h-[190px]">
        <div className="pointer-events-none absolute inset-0">
          {[20, 40, 60, 80].map((top) => (
            <div
              key={top}
              className="absolute inset-x-0 border-t border-dashed border-white/[0.045]"
              style={{ top: `${top}%` }}
            />
          ))}
        </div>

        <div className="absolute bottom-4 left-7 right-1 top-2 flex items-end gap-1.5">
          {performanceBars.map((height, index) => (
            <div
              key={`${height}-${index}`}
              className="chart-column group/bar relative flex-1 overflow-hidden rounded-t-[5px] bg-gradient-to-t from-cyan-950/75 via-cyan-500/45 to-cyan-200/88 shadow-[0_0_12px_rgba(34,211,238,0.05)] transition duration-300 hover:brightness-125"
              style={
                {
                  height: `${height}%`,
                  animationDelay: `${430 + index * 60}ms`,
                } as CSSProperties
              }
            >
              <div className="absolute inset-x-0 top-0 h-px bg-cyan-50/80" />

              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.11] to-transparent opacity-0 transition group-hover/bar:opacity-100" />
            </div>
          ))}
        </div>

        <svg
          className="absolute bottom-5 left-7 right-1 top-2 h-[calc(100%-1.75rem)] w-[calc(100%-2rem)] overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient
              id="chart-area"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="rgb(34 211 238)"
                stopOpacity="0.25"
              />
              <stop
                offset="100%"
                stopColor="rgb(34 211 238)"
                stopOpacity="0"
              />
            </linearGradient>

            <filter id="line-glow">
              <feGaussianBlur
                result="blurred"
                stdDeviation="1.45"
              />

              <feMerge>
                <feMergeNode in="blurred" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d={`${chartPath} L 100 100 L 0 100 Z`}
            fill="url(#chart-area)"
          />

          <path
            className="chart-path"
            d={chartPath}
            fill="none"
            filter="url(#line-glow)"
            stroke="rgb(103 232 249)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.35"
            vectorEffect="non-scaling-stroke"
          />

          <circle
            cx="100"
            cy="16"
            fill="#07121b"
            r="2.4"
            stroke="rgb(103 232 249)"
            strokeWidth="1.35"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="absolute right-0 top-0 rounded-xl border border-cyan-300/25 bg-[#07141e]/95 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35),0_0_20px_rgba(34,211,238,0.07)] transition duration-300 group-hover:-translate-y-0.5 group-hover:border-cyan-300/40">
          <p className="text-[11px] font-semibold">$18,421</p>

          <p className="mt-0.5 text-[8px] font-semibold text-emerald-300">
            +12.7%
          </p>
        </div>

        <div className="absolute bottom-0 left-7 right-1 flex justify-between text-[7px] uppercase tracking-[0.1em] text-slate-700">
          <span>May 20</span>
          <span>May 27</span>
          <span>Jun 3</span>
          <span>Jun 10</span>
          <span>Jun 17</span>
        </div>
      </div>
    </div>
  );
}

function RecentActivity() {
  const activity = [
    {
      title: "Inventory imported",
      detail: "248 cards added",
      value: "+248",
    },
    {
      title: "Marketplace sale",
      detail: "Order #10291",
      value: "$45.72",
    },
    {
      title: "Price movement",
      detail: "12 items increased",
      value: "+6.4%",
    },
    {
      title: "Listing published",
      detail: "Black Lotus (NM)",
      value: "Live",
    },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.075] bg-white/[0.022] p-4 transition duration-300 hover:border-cyan-300/[0.16] hover:bg-cyan-400/[0.025]">
      <p className="text-[11px] font-semibold">Recent activity</p>

      <div className="mt-4 space-y-4">
        {activity.map((item) => (
          <div
            key={item.title}
            className="group flex items-start justify-between gap-3 rounded-lg transition hover:bg-white/[0.018]"
          >
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium text-slate-200 transition group-hover:text-white">
                {item.title}
              </p>

              <p className="mt-1 truncate text-[8px] text-slate-700">
                {item.detail}
              </p>
            </div>

            <p className="shrink-0 text-[8px] font-semibold text-emerald-300">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeadlineFeature({
  feature,
  hasDivider,
}: {
  feature: {
    title: string;
    description: string;
    icon: LucideIcon;
  };
  hasDivider: boolean;
}) {
  const Icon = feature.icon;

  return (
    <article
      className={[
        "group relative flex items-center gap-4 rounded-2xl px-2 py-2 transition duration-300 hover:bg-cyan-400/[0.025] lg:pr-5",
        hasDivider
          ? "lg:after:absolute lg:after:-right-1 lg:after:h-12 lg:after:w-px lg:after:bg-white/[0.065]"
          : "",
      ].join(" ")}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/[0.13] bg-cyan-400/[0.07] text-cyan-300 shadow-[0_0_22px_rgba(34,211,238,0.05)] transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:border-cyan-300/30 group-hover:bg-cyan-400/[0.12] group-hover:shadow-[0_0_28px_rgba(34,211,238,0.13)]">
        <Icon className="h-5 w-5" />
      </div>

      <div>
        <h3 className="text-sm font-semibold transition group-hover:text-cyan-50">
          {feature.title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate-500 transition group-hover:text-slate-400">
          {feature.description}
        </p>
      </div>
    </article>
  );
}

function PlatformCard({
  feature,
  index,
}: {
  feature: {
    title: string;
    description: string;
    icon: LucideIcon;
    status: string;
  };
  index: number;
}) {
  const Icon = feature.icon;

  return (
    <article
      className="platform-card group relative min-h-[260px] overflow-hidden rounded-[25px] border border-white/[0.085] bg-[#07121b]/75 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl"
      style={{ "--delay": `${index * 70}ms` } as CSSProperties}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/[0.045] via-transparent to-violet-500/[0.035] opacity-0 transition duration-500 group-hover:opacity-100" />

      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/[0.05] blur-[65px] transition duration-500 group-hover:bg-cyan-400/[0.095]" />

      <div className="relative">
        <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.055] bg-black/[0.12] transition duration-500 group-hover:border-cyan-300/[0.15]">
          <div className="absolute h-20 w-20 rounded-full border border-cyan-300/16 transition duration-700 group-hover:scale-110 group-hover:rotate-12" />

          <div className="absolute h-14 w-28 rotate-[-18deg] rounded-[50%] border border-violet-400/17 transition duration-700 group-hover:rotate-[8deg]" />

          <div className="absolute h-12 w-24 rotate-[20deg] rounded-[50%] border border-cyan-400/13 transition duration-700 group-hover:rotate-[42deg]" />

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/[0.09] text-cyan-200 shadow-[0_0_25px_rgba(34,211,238,0.1)] transition duration-500 group-hover:-translate-y-1 group-hover:scale-110 group-hover:rotate-3 group-hover:border-cyan-300/45 group-hover:shadow-[0_0_35px_rgba(34,211,238,0.2)]">
            <Icon className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">
            {feature.title}
          </h3>

          <span className="rounded-full border border-cyan-300/[0.1] bg-cyan-400/[0.04] px-2 py-1 text-[9px] font-medium text-cyan-300/75 transition group-hover:border-cyan-300/20 group-hover:bg-cyan-400/[0.08] group-hover:text-cyan-200">
            {feature.status}
          </span>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500 transition group-hover:text-slate-400">
          {feature.description}
        </p>
      </div>
    </article>
  );
}

function WorkflowCard({
  number,
  title,
  description,
  icon: Icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <article className="group relative rounded-[24px] border border-white/[0.08] bg-[#061018]/70 p-6 transition duration-400 hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-[#07131c] hover:shadow-[0_24px_70px_rgba(0,0,0,0.28),0_0_28px_rgba(34,211,238,0.04)]">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.07] text-cyan-300 transition duration-300 group-hover:scale-105 group-hover:border-cyan-300/30 group-hover:bg-cyan-400/[0.12] group-hover:shadow-[0_0_24px_rgba(34,211,238,0.12)]">
          <Icon className="h-5 w-5" />
        </div>

        <span className="font-mono text-xs text-slate-700 transition group-hover:text-cyan-300/50">
          {number}
        </span>
      </div>

      <h3 className="mt-6 text-lg font-semibold">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-slate-500 transition group-hover:text-slate-400">
        {description}
      </p>
    </article>
  );
}

function MarketplaceBadge({
  label,
  muted = false,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <div
      className={[
        "flex h-12 min-w-[142px] items-center justify-center rounded-2xl border px-6 text-sm font-semibold transition duration-300 hover:-translate-y-1",
        muted
          ? "border-white/[0.07] bg-white/[0.018] text-slate-600 hover:border-white/[0.12] hover:text-slate-400"
          : "border-white/[0.09] bg-[#07121b]/65 text-slate-200 hover:border-cyan-300/20 hover:bg-cyan-400/[0.035] hover:text-white hover:shadow-[0_15px_35px_rgba(0,0,0,0.22),0_0_20px_rgba(34,211,238,0.04)]",
      ].join(" ")}
    >
      {label}
    </div>
  );
}

function FloatingLogo() {
  return (
    <div className="floating-logo relative mr-8 hidden h-32 w-44 items-center justify-center lg:flex">
      <div className="absolute inset-x-0 bottom-1 h-8 rounded-full bg-cyan-400/[0.14] blur-2xl" />

      <div className="absolute h-24 w-24 rotate-6 rounded-[24px] border border-violet-300/35 bg-violet-500/[0.065] shadow-[0_0_35px_rgba(139,92,246,0.14)]" />

      <div className="relative flex h-24 w-24 -rotate-6 items-center justify-center rounded-[24px] border border-cyan-200/50 bg-gradient-to-br from-cyan-400/[0.16] to-blue-500/[0.065] shadow-[0_0_40px_rgba(34,211,238,0.18)] backdrop-blur-xl">
        <span className="text-4xl font-semibold tracking-[-0.12em]">
          T<span className="text-cyan-300">D</span>
        </span>
      </div>
    </div>
  );
}