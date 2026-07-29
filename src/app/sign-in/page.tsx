import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  Database,
  Gem,
  Layers3,
  LockKeyhole,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingUp,
  Zap,
} from "lucide-react";

import { login, loginWithGoogle } from "@/app/actions/auth";
import { RememberedEmailField } from "@/components/auth/RememberedEmailField";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    next?: string;
  }>;
};

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

type MetricProps = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
};

type FloatingModuleProps = {
  className: string;
  eyebrow: string;
  title: string;
  detail: string;
  icon: ReactNode;
};

function FeatureCard({
  icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <div className="feature-card group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3 transition duration-500 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-400/[0.055] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_34px_rgba(0,0,0,0.18),0_0_24px_rgba(34,211,238,0.04)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(103,232,249,0.08),transparent_30%)] opacity-0 transition duration-500 group-hover:opacity-100" />

      <div className="relative flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 transition duration-500 group-hover:-translate-y-0.5 group-hover:border-cyan-300/40 group-hover:bg-cyan-400/15 group-hover:text-cyan-200">
          {icon}
        </div>

        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-white">{title}</h3>

          <p className="mt-1 truncate text-[10px] text-slate-400 tracking-[0.02em]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
}: MetricProps) {
  return (
    <div className="metric-card rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[7px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>

          <p className="mt-1 text-xs font-semibold text-white">
            {value}
          </p>

          <p className="mt-0.5 truncate text-[8px] text-slate-600">
            {detail}
          </p>
        </div>

        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-400/10 text-cyan-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function FloatingModule({
  className,
  eyebrow,
  title,
  detail,
  icon,
}: FloatingModuleProps) {
  return (
    <div
      className={`absolute z-30 hidden min-w-[145px] rounded-xl border border-cyan-300/20 bg-[#09141c]/90 p-2.5 shadow-[0_18px_45px_rgba(0,0,0,0.45),0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl xl:block ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-[6px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {eyebrow}
          </p>

          <p className="mt-0.5 text-[10px] font-semibold text-white">
            {title}
          </p>

          <p className="mt-0.5 text-[7px] text-slate-500">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function LiveActivityTicker() {
  const updates = [
    "Inventory synced",
    "248 cards imported",
    "eBay listings updated",
    "Marketplace prices refreshed",
    "Mana Pool connected",
  ];

  return (
    <div className="mt-3 flex h-5 items-center overflow-visible">
      <span className="status-indicator relative mr-2 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span className="status-halo absolute h-3.5 w-3.5 rounded-full bg-emerald-400/20 blur-[5px]" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300" />
      </span>

      <div className="relative h-4 flex-1 overflow-hidden">
        {updates.map((update, index) => (
          <span
            key={update}
            className="live-activity-item absolute inset-0 flex items-center text-[9px] font-medium text-slate-500"
            style={{ animationDelay: `${index * 3}s` }}
          >
            {update}
          </span>
        ))}
      </div>
    </div>
  );
}

function PortfolioChart() {
  return (
    <div className="relative mt-2 h-[68px] overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-white/[0.05]" />
        <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-white/[0.05]" />
      </div>

      <svg
        viewBox="0 0 600 180"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-label="Portfolio value growth chart"
      >
        <defs>
          <linearGradient
            id="signInPortfolioFill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="rgb(34 211 238)"
              stopOpacity="0.34"
            />

            <stop
              offset="58%"
              stopColor="rgb(34 211 238)"
              stopOpacity="0.08"
            />

            <stop
              offset="100%"
              stopColor="rgb(34 211 238)"
              stopOpacity="0"
            />
          </linearGradient>

          <linearGradient
            id="signInPortfolioStroke"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0%" stopColor="rgb(103 232 249)" />
            <stop offset="55%" stopColor="rgb(34 211 238)" />
            <stop offset="100%" stopColor="rgb(56 189 248)" />
          </linearGradient>

          <filter id="signInChartGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />

            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d="M0 148
             C28 143, 48 128, 77 134
             C104 140, 121 114, 149 119
             C177 125, 193 98, 220 105
             C249 113, 267 84, 296 91
             C325 99, 342 69, 371 76
             C400 83, 421 58, 449 63
             C477 69, 497 42, 526 48
             C554 54, 576 31, 600 22
             L600 180 L0 180 Z"
          fill="url(#signInPortfolioFill)"
          className="chart-area"
        />

        <path
          d="M0 148
             C28 143, 48 128, 77 134
             C104 140, 121 114, 149 119
             C177 125, 193 98, 220 105
             C249 113, 267 84, 296 91
             C325 99, 342 69, 371 76
             C400 83, 421 58, 449 63
             C477 69, 497 42, 526 48
             C554 54, 576 31, 600 22"
          fill="none"
          stroke="url(#signInPortfolioStroke)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#signInChartGlow)"
          className="chart-line"
        />

        <circle
          cx="600"
          cy="22"
          r="7"
          fill="rgb(165 243 252)"
          className="chart-point"
        />

        <circle
          cx="600"
          cy="22"
          r="15"
          fill="rgb(34 211 238)"
          opacity="0.14"
          className="chart-pulse"
        />
      </svg>

      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[6px] font-medium uppercase tracking-[0.1em] text-slate-700">
        <span>Jan</span>
        <span>Mar</span>
        <span>May</span>
        <span>Jul</span>
        <span>Sep</span>
        <span>Dec</span>
      </div>
    </div>
  );
}

export default async function SignInPage({
  searchParams,
}: SignInPageProps) {
  const { error, success, next } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#03080c] text-white lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <style>{`
        @keyframes ambientGlow {
          0%, 100% {
            opacity: 0.52;
            transform: translate3d(0, 0, 0) scale(1);
          }

          50% {
            opacity: 0.88;
            transform: translate3d(14px, -10px, 0) scale(1.07);
          }
        }

        @keyframes dashboardFloat {
          0%, 100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes formFloat {
          0%, 100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-3px);
          }
        }

        @keyframes moduleFloatOne {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }

          50% {
            transform: translate3d(0, -9px, 0);
          }
        }

        @keyframes moduleFloatTwo {
          0%, 100% {
            transform: translate3d(0, -3px, 0);
          }

          50% {
            transform: translate3d(0, 7px, 0);
          }
        }

        @keyframes cardGlow {
          0%, 100% {
            border-color: rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.035);
          }

          50% {
            border-color: rgba(34, 211, 238, 0.22);
            background: rgba(34, 211, 238, 0.05);
          }
        }

        @keyframes sweep {
          0%, 76% {
            transform: translateX(-170%) skewX(-16deg);
            opacity: 0;
          }

          80% {
            opacity: 0.22;
          }

          92% {
            transform: translateX(320%) skewX(-16deg);
            opacity: 0.12;
          }

          96%, 100% {
            transform: translateX(320%) skewX(-16deg);
            opacity: 0;
          }
        }

        @keyframes drawLine {
          from {
            stroke-dashoffset: 1400;
          }

          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes revealArea {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes pulsePoint {
          0%, 100% {
            opacity: 0.14;
            transform: scale(0.85);
            transform-origin: 600px 22px;
          }

          50% {
            opacity: 0.36;
            transform: scale(1.24);
            transform-origin: 600px 22px;
          }
        }

        @keyframes securePulse {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(34, 211, 238, 0),
              0 8px 24px rgba(6, 182, 212, 0.07);
          }

          50% {
            box-shadow:
              0 0 0 7px rgba(34, 211, 238, 0.025),
              0 12px 30px rgba(6, 182, 212, 0.14);
          }
        }

        @keyframes liveActivityCycle {
          0%, 16% {
            opacity: 0;
            transform: translateY(8px);
          }

          20%, 32% {
            opacity: 1;
            transform: translateY(0);
          }

          36%, 100% {
            opacity: 0;
            transform: translateY(-8px);
          }
        }

        @keyframes ctaReflection {
          0%, 72% {
            transform: translateX(-180%) skewX(-18deg);
            opacity: 0;
          }

          76% {
            opacity: 0.9;
          }

          90% {
            transform: translateX(420%) skewX(-18deg);
            opacity: 0.55;
          }

          94%, 100% {
            transform: translateX(420%) skewX(-18deg);
            opacity: 0;
          }
        }

        @keyframes orbitDriftOne {
          0%, 100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.18;
          }

          50% {
            transform: translate3d(90px, -38px, 0);
            opacity: 0.5;
          }
        }

        @keyframes orbitDriftTwo {
          0%, 100% {
            transform: translate3d(0, 0, 0);
            opacity: 0.16;
          }

          50% {
            transform: translate3d(-72px, 52px, 0);
            opacity: 0.44;
          }
        }

        @keyframes streamFlow {
          0% {
            background-position: 0 0;
            opacity: 0.08;
          }

          100% {
            background-position: 72px 0;
            opacity: 0.16;
          }
        }

        .live-activity-item {
          opacity: 0;
          animation: liveActivityCycle 15s ease-in-out infinite;
        }

        .premium-cta {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }

        .premium-cta::before {
          content: "";
          position: absolute;
          inset: -55% auto -55% -35%;
          width: 28%;
          background: linear-gradient(
            105deg,
            transparent,
            rgba(255, 255, 255, 0.48),
            transparent
          );
          filter: blur(8px);
          animation: ctaReflection 20s cubic-bezier(0.22, 1, 0.36, 1) infinite;
          pointer-events: none;
        }

        .signature-dot-one,
        .signature-dot-two,
        .signature-dot-three {
          position: absolute;
          height: 3px;
          width: 3px;
          border-radius: 999px;
          background: rgba(103, 232, 249, 0.75);
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.42);
          pointer-events: none;
        }

        .signature-dot-one {
          left: 48%;
          top: 18%;
          animation: orbitDriftOne 18s ease-in-out infinite;
        }

        .signature-dot-two {
          left: 57%;
          top: 66%;
          animation: orbitDriftTwo 24s ease-in-out infinite;
        }

        .signature-dot-three {
          left: 38%;
          top: 78%;
          animation: orbitDriftOne 28s ease-in-out infinite reverse;
        }

        .data-streams {
          background-image:
            linear-gradient(90deg, transparent 0 48%, rgba(103,232,249,0.08) 50%, transparent 52%),
            linear-gradient(90deg, transparent 0 48%, rgba(59,130,246,0.05) 50%, transparent 52%);
          background-size: 72px 1px, 96px 1px;
          background-repeat: repeat-x;
          animation: streamFlow 20s linear infinite alternate;
        }

        @keyframes syncTimeOne {
          0%, 30% {
            opacity: 1;
            transform: translateY(0);
          }

          33%, 100% {
            opacity: 0;
            transform: translateY(-7px);
          }
        }

        @keyframes syncTimeTwo {
          0%, 31% {
            opacity: 0;
            transform: translateY(7px);
          }

          34%, 63% {
            opacity: 1;
            transform: translateY(0);
          }

          66%, 100% {
            opacity: 0;
            transform: translateY(-7px);
          }
        }

        @keyframes syncTimeThree {
          0%, 64% {
            opacity: 0;
            transform: translateY(7px);
          }

          67%, 96% {
            opacity: 1;
            transform: translateY(0);
          }

          100% {
            opacity: 0;
            transform: translateY(-7px);
          }
        }

        .sync-time {
          opacity: 0;
        }

        .sync-time-one {
          animation: syncTimeOne 180s linear infinite;
        }

        .sync-time-two {
          animation: syncTimeTwo 180s linear infinite;
        }

        .sync-time-three {
          animation: syncTimeThree 180s linear infinite;
        }

        @keyframes statusPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.18);
            opacity: 1;
          }
        }

        .status-halo {
          animation: statusPulse 4.8s ease-in-out infinite;
        }

        .ambient-glow {
          animation: ambientGlow 10s ease-in-out infinite;
        }

        .dashboard-float {
          animation: dashboardFloat 7s ease-in-out infinite;
        }

        .form-float {
          animation: formFloat 7.5s ease-in-out infinite;
        }

        .module-float-one {
          animation: moduleFloatOne 5.5s ease-in-out infinite;
        }

        .module-float-two {
          animation: moduleFloatTwo 6.5s ease-in-out infinite;
        }

        .module-float-three {
          animation: moduleFloatOne 7.5s ease-in-out infinite reverse;
        }

        .metric-card:nth-child(1) {
          animation: cardGlow 6s ease-in-out infinite;
        }

        .metric-card:nth-child(2) {
          animation: cardGlow 6s ease-in-out 1s infinite;
        }

        .metric-card:nth-child(3) {
          animation: cardGlow 6s ease-in-out 2s infinite;
        }

        .metric-card:nth-child(4) {
          animation: cardGlow 6s ease-in-out 3s infinite;
        }

        .metric-card:nth-child(5) {
          animation: cardGlow 6s ease-in-out 4s infinite;
        }

        .metric-card:nth-child(6) {
          animation: cardGlow 6s ease-in-out 5s infinite;
        }

        .dashboard-sweep {
          animation: sweep 36s cubic-bezier(0.22, 1, 0.36, 1) infinite;
          will-change: transform, opacity;
        }

        .chart-line {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: drawLine 2.2s ease-out forwards;
        }

        .chart-area {
          opacity: 0;
          animation: revealArea 1.3s ease-out 0.7s forwards;
        }

        .chart-point {
          opacity: 0;
          animation: revealArea 0.6s ease-out 2s forwards;
        }

        .chart-pulse {
          animation: pulsePoint 2.8s ease-in-out infinite;
        }

        .secure-icon {
          animation: securePulse 4s ease-in-out infinite;
        }

        @media (max-height: 850px) and (min-width: 1024px) {
          .desktop-scale {
            transform: scale(0.9);
            transform-origin: center;
          }
        }

        @media (max-height: 760px) and (min-width: 1024px) {
          .desktop-scale {
            transform: scale(0.82);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ambient-glow,
          .dashboard-float,
          .form-float,
          .module-float-one,
          .module-float-two,
          .module-float-three,
          .metric-card,
          .dashboard-sweep,
          .chart-line,
          .chart-area,
          .chart-point,
          .chart-pulse,
          .secure-icon,
          .live-activity-item,
          .premium-cta::before,
          .signature-dot-one,
          .signature-dot-two,
          .signature-dot-three,
          .data-streams,
          .sync-time-one,
          .sync-time-two,
          .sync-time-three {
            animation: none !important;
          }
          .status-halo {
            animation: none !important;
          }

          .sync-time-one {
            opacity: 1;
            transform: none;
          }

          .sync-time-two,
          .sync-time-three {
            opacity: 0;
          }

          .chart-line {
            stroke-dashoffset: 0;
          }

          .chart-area,
          .chart-point {
            opacity: 1;
          }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.1]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.14) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
        }}
      />

      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none absolute -left-44 -top-52 h-[620px] w-[620px] rounded-full bg-cyan-500/[0.12] blur-[165px]"
      />

      <div
        aria-hidden="true"
        className="ambient-glow pointer-events-none absolute -bottom-56 right-[-110px] h-[620px] w-[620px] rounded-full bg-blue-500/[0.08] blur-[185px]"
        style={{ animationDelay: "-4s" }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[53%] top-1/2 hidden h-[70%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-300/10 to-transparent lg:block"
      />

      <div
        aria-hidden="true"
        className="data-streams pointer-events-none absolute left-[34%] top-[18%] hidden h-px w-[34%] lg:block"
      />

      <span aria-hidden="true" className="signature-dot-one hidden lg:block" />
      <span aria-hidden="true" className="signature-dot-two hidden lg:block" />
      <span aria-hidden="true" className="signature-dot-three hidden lg:block" />

      <div className="desktop-scale relative mx-auto grid min-h-screen w-full max-w-[1360px] grid-cols-1 px-5 py-7 sm:px-8 lg:h-screen lg:min-h-0 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-12 lg:px-8 lg:py-4 xl:gap-16">
        <section className="hidden h-full min-h-0 items-center lg:flex">
          <div className="w-full max-w-[640px]">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                aria-label="Return to Trading Docks home"
                className="group inline-flex items-center gap-3"
              >
                <span className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center">
                  <span className="absolute inset-1 rounded-[20px] bg-cyan-400/[0.15] blur-xl transition duration-500 group-hover:bg-cyan-300/[0.24]" />

                  <Image
                    src="/trading-docks-mark.png"
                    alt=""
                    width={1024}
                    height={1024}
                    priority
                    className="relative h-[60px] w-[60px] object-contain transition duration-500 group-hover:-translate-y-0.5 group-hover:scale-[1.045]"
                  />
                </span>

                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold tracking-[-0.025em] text-white">
                    Trading Docks
                  </span>

                  <span className="mt-0.5 text-[7px] font-medium uppercase tracking-[0.24em] text-slate-600">
                    Collectibles OS
                  </span>
                </span>
              </Link>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 backdrop-blur-md">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                  <Layers3 className="h-2.5 w-2.5" />
                </span>

                <span className="text-[9px] font-medium text-slate-300">
                  Built for collectors, sellers, and stores
                </span>
              </div>
            </div>

            <h1 className="mt-4 max-w-[630px] text-[clamp(2.45rem,3.8vw,3.8rem)] font-semibold leading-[0.96] tracking-[-0.058em] text-white">
              Run your collectibles business
              <span className="mt-3 block bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-500 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.05)]">
                from one place.
              </span>
            </h1>

            <p className="mt-3 max-w-[610px] text-xs leading-5 text-slate-400 xl:text-sm">
              Track singles, sealed products, graded cards, binders, supplies,
              bulk inventory, listings, sales, pricing, and exact storage
              locations from one complete inventory and operations platform.
            </p>

            <LiveActivityTicker />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <FeatureCard
                icon={<Layers3 className="h-3.5 w-3.5" />}
                title="Set and Chaos Sort"
                description="Turn unsorted cards into structured inventory."
              />

              <FeatureCard
                icon={<Search className="h-3.5 w-3.5" />}
                title="Find any card quickly"
                description="Search by set, binder, box, grade, or location."
              />

              <FeatureCard
                icon={<Gem className="h-3.5 w-3.5" />}
                title="Graded and sealed"
                description="Track slabs, sealed products, and supplies."
              />

              <FeatureCard
                icon={<Boxes className="h-3.5 w-3.5" />}
                title="Complete inventory system"
                description="Built for collections, sellers, and stores."
              />
            </div>

            <div className="relative mt-3">
              <div
                aria-hidden="true"
                className="ambient-glow pointer-events-none absolute -inset-24 rounded-[72px] bg-cyan-500/[0.09] blur-[125px]"
              />

              <FloatingModule
                className="-left-10 top-8 module-float-one"
                eyebrow="Sorting module"
                title="Chaos Sort"
                detail="1,284 cards matched"
                icon={<Sparkles className="h-3.5 w-3.5" />}
              />

              <FloatingModule
                className="-right-8 top-11 module-float-two"
                eyebrow="Collection storage"
                title="Binder 04"
                detail="312 cards indexed"
                icon={<Database className="h-3.5 w-3.5" />}
              />

              <FloatingModule
                className="-bottom-4 left-20 module-float-three"
                eyebrow="Inventory search"
                title="Card located"
                detail="Box A17 · Row 3"
                icon={<Search className="h-3.5 w-3.5" />}
              />

              <div className="dashboard-float relative scale-[1.055] overflow-hidden rounded-[20px] border border-cyan-300/20 bg-white/[0.04] p-1 shadow-[0_24px_75px_rgba(0,0,0,0.5),0_0_45px_rgba(34,211,238,0.09)] backdrop-blur-xl">
                <div className="dashboard-sweep pointer-events-none absolute -inset-y-8 left-0 z-20 w-28 bg-gradient-to-r from-transparent via-white/[0.018] to-transparent blur-[10px]" />

                <div className="relative overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#071017]/95 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[7px] font-medium uppercase tracking-[0.16em] text-slate-500">
                          Inventory workspace
                        </p>

                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/10 bg-emerald-300/[0.035] px-2 py-0.5 text-[6px] font-semibold text-emerald-300">
                          <span className="h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_7px_rgba(110,231,183,0.8)]" />
                          Last sync
                          <span className="relative inline-block h-2.5 min-w-[46px] overflow-hidden align-middle">
                            <span className="sync-time sync-time-one absolute inset-0">Just now</span>
                            <span className="sync-time sync-time-two absolute inset-0">1 minute ago</span>
                            <span className="sync-time sync-time-three absolute inset-0">2 minutes ago</span>
                          </span>
                        </span>
                      </div>

                      <p className="mt-0.5 text-sm font-semibold text-white">
                        Business overview
                      </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-1.5">
                      <Search className="h-2.5 w-2.5 text-cyan-300" />

                      <span className="text-[7px] text-slate-500">
                        Find any card
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    <Metric
                      label="Inventory"
                      value="48,821"
                      detail="All inventory types"
                      icon={<Boxes className="h-3 w-3" />}
                    />

                    <Metric
                      label="Listings"
                      value="22,640"
                      detail="Connected channels"
                      icon={<Tags className="h-3 w-3" />}
                    />

                    <Metric
                      label="Graded"
                      value="382"
                      detail="PSA, BGS, CGC"
                      icon={<Gem className="h-3 w-3" />}
                    />

                    <Metric
                      label="Sealed"
                      value="1,246"
                      detail="Boxes, decks, cases"
                      icon={<Package className="h-3 w-3" />}
                    />

                    <Metric
                      label="Binders"
                      value="18"
                      detail="Searchable locations"
                      icon={<Database className="h-3 w-3" />}
                    />

                    <Metric
                      label="Value"
                      value="$284,860"
                      detail="+8.4% this month"
                      icon={<TrendingUp className="h-3 w-3" />}
                    />
                  </div>

                  <div className="mt-2.5 grid grid-cols-[1.12fr_0.88fr] gap-2">
                    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[7px] font-medium uppercase tracking-[0.14em] text-slate-500">
                            Inventory value
                          </p>

                          <p className="mt-0.5 text-xs font-semibold text-white">
                            Portfolio growth
                          </p>
                        </div>

                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[7px] font-semibold text-emerald-300">
                          +18.2%
                        </span>
                      </div>

                      <PortfolioChart />
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[7px] font-medium uppercase tracking-[0.14em] text-slate-500">
                            Live activity
                          </p>

                          <p className="mt-0.5 text-xs font-semibold text-white">
                            Recent updates
                          </p>
                        </div>

                        <Zap className="h-3 w-3 text-cyan-300" />
                      </div>

                      <div className="mt-1.5 space-y-1.5">
                        {[
                          ["Chaos Sort completed", "846 cards organized"],
                          ["Binder location updated", "Mana Crypt · P12"],
                          ["Graded card imported", "PSA 10 added"],
                        ].map(([title, detail]) => (
                          <div
                            key={title}
                            className="flex items-center gap-1.5 border-b border-white/[0.06] pb-1.5 last:border-b-0 last:pb-0"
                          >
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                              <Check className="h-2.5 w-2.5" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-[8px] font-semibold text-white">
                                {title}
                              </p>

                              <p className="truncate text-[7px] text-slate-600">
                                {detail}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-3 text-[8px] text-slate-600">
              <span>© 2026 Trading Docks</span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span>Collectibles inventory and operations</span>
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center lg:h-full lg:min-h-0 lg:-translate-x-5">
          <div className="w-full max-w-[410px]">
            <Link
              href="/"
              aria-label="Return to Trading Docks home"
              className="group mb-6 flex items-center justify-center gap-3 lg:hidden"
            >
              <span className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center">
                <span className="absolute inset-1 rounded-[20px] bg-cyan-400/[0.15] blur-xl transition duration-500 group-hover:bg-cyan-300/[0.24]" />

                <Image
                  src="/trading-docks-mark.png"
                  alt=""
                  width={1024}
                  height={1024}
                  priority
                  className="relative h-[60px] w-[60px] object-contain transition duration-500 group-hover:-translate-y-0.5 group-hover:scale-[1.045]"
                />
              </span>

              <span className="flex flex-col text-left">
                <span className="text-base font-semibold tracking-[-0.025em] text-white">
                  Trading Docks
                </span>

                <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.24em] text-slate-600">
                  Collectibles OS
                </span>
              </span>
            </Link>

            <div className="form-float relative">
              <div
                aria-hidden="true"
                className="ambient-glow pointer-events-none absolute -inset-9 rounded-[50px] bg-cyan-500/[0.11] blur-[65px]"
              />

              <div className="relative overflow-hidden rounded-[26px] border border-cyan-300/20 bg-white/[0.04] p-1 shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_50px_rgba(34,211,238,0.09)] backdrop-blur-2xl">
                <div className="dashboard-sweep pointer-events-none absolute -inset-y-8 left-0 z-20 w-28 bg-gradient-to-r from-transparent via-white/[0.015] to-transparent blur-[10px]" />

                <div className="relative overflow-hidden rounded-[21px] border border-white/[0.08] bg-[#071017]/95 px-6 py-5">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-cyan-400/[0.08] blur-3xl"
                  />

                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="secure-icon flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                        <LockKeyhole className="h-4 w-4" />
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[8px] font-medium text-slate-400">
                        <ShieldCheck className="h-2.5 w-2.5 text-cyan-300" />
                        Secure access
                      </span>
                    </div>

                    <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
                      Welcome back
                    </h2>

                    <p className="mt-1.5 text-xs leading-5 text-slate-400">
                      Sign in to manage your collection, inventory, sorting,
                      storage locations, marketplace listings, and business
                      activity.
                    </p>

                    {error ? (
                      <div
                        role="alert"
                        className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200"
                      >
                        {error}
                      </div>
                    ) : null}

                    {success ? (
                      <div
                        role="status"
                        className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"
                      >
                        {success}
                      </div>
                    ) : null}

                    <form action={loginWithGoogle} className="mt-4">
                      <input name="next" type="hidden" value={next ?? ""} />
                      <button
                        type="submit"
                        className="flex h-11 w-full items-center justify-center gap-3 rounded-[12px] border border-white/15 bg-white px-4 text-xs font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-white/15"
                      >
                        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z" />
                          <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.35l-3.24-2.55c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.77-5.61-4.14H3.04v2.63A10 10 0 0 0 12 22Z" />
                          <path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.45H3.04A10 10 0 0 0 2 12c0 1.64.39 3.2 1.04 4.55l3.35-2.63Z" />
                          <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.63C7.18 7.71 9.39 5.94 12 5.94Z" />
                        </svg>
                        Continue with Google
                      </button>
                    </form>

                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                      <span className="text-[9px] uppercase tracking-[0.18em] text-slate-500">
                        or use email
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                    </div>

                    <form action={login} className="space-y-3">
                      <input name="next" type="hidden" value={next ?? ""} />
                      <RememberedEmailField />

                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label
                            htmlFor="password"
                            className="text-[10px] font-medium text-slate-200"
                          >
                            Password
                          </label>

                          <Link
                            href="/forgot-password"
                            className="text-[9px] font-medium text-cyan-300 transition hover:text-cyan-200"
                          >
                            Forgot password?
                          </Link>
                        </div>

                        <input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          placeholder="Enter your password"
                          className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.035] px-3.5 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-400/50 focus:bg-cyan-400/[0.035] focus:ring-4 focus:ring-cyan-400/10"
                        />
                      </div>

                      <button
                        type="submit"
                        className="premium-cta group flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 px-4 text-xs font-semibold text-slate-950 shadow-[0_14px_32px_rgba(6,182,212,0.26),inset_0_1px_0_rgba(255,255,255,0.68),inset_0_-1px_0_rgba(3,105,161,0.3)] transition duration-300 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_18px_40px_rgba(6,182,212,0.34),inset_0_1px_0_rgba(255,255,255,0.72)] focus:outline-none focus:ring-4 focus:ring-cyan-400/20"
                      >
                        Sign in
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </button>
                    </form>

                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />

                      <span className="text-[9px] text-slate-500">
                        New to Trading Docks?
                      </span>

                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                    </div>

                    <Link
                      href="/sign-up"
                      className="flex h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-cyan-400/[0.07]"
                    >
                      Create an account
                    </Link>

                    <div className="mt-4 flex items-center justify-center gap-2 text-[8px] text-slate-500">
                      <Check className="h-3 w-3 text-cyan-400" />
                      Authentication securely powered by Supabase
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[9px] text-slate-600 lg:hidden">
              © 2026 Trading Docks
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
