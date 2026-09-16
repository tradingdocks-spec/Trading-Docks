"use client";

import Image from "next/image";

import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export function PortfolioHero() {
  return (
    <section className="portfolio-hero group relative overflow-hidden rounded-[30px] border border-td-accent/[0.11] bg-td-surface/94 shadow-[0_30px_95px_rgb(var(--td-shadow-rgb)/calc(0.36*var(--td-shadow-strength)))] backdrop-blur-2xl">
      <HeroBackground />

      <div className="relative grid min-h-[265px] gap-9 px-7 py-8 sm:px-9 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:px-10">
        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-3">
            <HeroBadge
              icon={Sparkles}
              label="Portfolio command center"
            />

            <div className="live-badge inline-flex items-center gap-2 rounded-full border border-td-success/[0.16] bg-td-success/[0.055] px-3 py-1.5 text-[11px] font-semibold text-td-success">
              <span className="h-1.5 w-1.5 rounded-full bg-td-success shadow-[0_0_10px_rgb(var(--td-accent-rgb)/0.9)]" />
              Live
            </div>
          </div>

          <h1 className="mt-6 font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-td-primary lg:text-[49px]">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-td-accent via-td-accent to-td-accent bg-clip-text text-transparent">
              there
            </span>
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-td-secondary sm:text-base">
            Here is the current pulse of your inventory, sales
            channels, and marketplace performance.
          </p>

          <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3">
            <HeroStatus
              icon={CheckCircle2}
              label="Workspace ready"
            />

            <HeroStatus
              icon={Clock3}
              label="No activity yet"
            />
          </div>
        </div>

        <PortfolioSummary />
      </div>

      <style jsx>{`
        @keyframes portfolio-enter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes summary-glow {
          0%,
          100% {
            opacity: 0.34;
            transform: scale(0.96);
          }

          50% {
            opacity: 0.62;
            transform: scale(1.04);
          }
        }

        @keyframes logo-float {
          0%,
          100% {
            transform: translateY(0) rotate(-3deg);
          }

          50% {
            transform: translateY(-5px) rotate(1deg);
          }
        }

        @keyframes ring-drift-one {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(-8deg);
          }

          50% {
            transform: translate3d(-5px, -3px, 0) rotate(-2deg);
          }
        }

        @keyframes ring-drift-two {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(12deg);
          }

          50% {
            transform: translate3d(5px, 3px, 0) rotate(5deg);
          }
        }

        .portfolio-hero {
          animation: portfolio-enter 650ms ease-out both;
          transition:
            border-color 400ms ease,
            box-shadow 400ms ease;
        }

        .portfolio-hero:hover {
          border-color: rgb(var(--td-accent-rgb)/0.2);
          box-shadow:
            0 34px 110px rgb(var(--td-shadow-rgb)/calc(0.44*var(--td-shadow-strength))),
            0 0 45px rgb(var(--td-accent-rgb)/0.045);
        }

        .portfolio-summary-glow {
          animation: summary-glow 6s ease-in-out infinite;
        }

        .portfolio-logo {
          animation: logo-float 5.5s ease-in-out infinite;
        }

        .portfolio-ring-one {
          animation: ring-drift-one 9s ease-in-out infinite;
        }

        .portfolio-ring-two {
          animation: ring-drift-two 11s ease-in-out infinite;
        }

        .live-badge {
          box-shadow: 0 0 20px rgb(var(--td-accent-rgb)/0.035);
        }

        @media (prefers-reduced-motion: reduce) {
          .portfolio-hero,
          .portfolio-summary-glow,
          .portfolio-logo,
          .portfolio-ring-one,
          .portfolio-ring-two {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}

function PortfolioSummary() {
  return (
    <div className="relative min-h-[202px] overflow-hidden rounded-[27px] border border-td-accent/[0.14] bg-gradient-to-br from-td-raised/95 via-td-surface/94 to-td-surface/95 p-6 shadow-[0_24px_75px_rgb(var(--td-shadow-rgb)/calc(0.34*var(--td-shadow-strength))),inset_0_1px_rgb(var(--td-ink-rgb)/0.035)] transition duration-500 group-hover:border-td-accent/[0.23] group-hover:shadow-[0_28px_90px_rgb(var(--td-shadow-rgb)/calc(0.42*var(--td-shadow-strength))),0_0_38px_rgb(var(--td-accent-rgb)/0.055)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_48%,rgb(var(--td-accent-rgb)/0.115),transparent_31%),radial-gradient(circle_at_100%_0%,rgb(var(--td-accent-rgb)/0.08),transparent_38%)]" />

      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-td-accent/50 to-transparent" />

      <div className="portfolio-summary-glow pointer-events-none absolute right-[-20px] top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-td-accent/[0.11] blur-[65px]" />

      <div className="relative z-10 flex h-full items-center justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-td-accent/[0.16] bg-td-accent/[0.055]">
              <span className="h-1.5 w-1.5 rounded-full bg-td-accent shadow-[0_0_9px_rgb(var(--td-accent-rgb)/0.75)]" />
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-td-secondary">
              Portfolio value
            </p>
          </div>

          <p className="mt-4 text-[39px] font-semibold tracking-[-0.05em] text-td-primary">
            $0
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-td-success/[0.18] bg-td-success/[0.065] px-3 py-1.5 text-[11px] font-semibold text-td-success shadow-[0_0_20px_rgb(var(--td-accent-rgb)/0.045)]">
              <ArrowUpRight className="h-3.5 w-3.5" />
              $0 today
            </div>

            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-td-secondary">
              <TrendingUp className="h-3.5 w-3.5 text-td-accent-text" />
              0.00%
            </div>
          </div>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-td-accent/[0.26] via-td-accent/[0.08] to-transparent" />

          <p className="mt-3 text-[11px] text-td-secondary">
            Add inventory to begin tracking value
          </p>
        </div>

        <PortfolioBrandMark />
      </div>
    </div>
  );
}

function PortfolioBrandMark() {
  return (
    <div className="relative hidden h-32 w-32 shrink-0 items-center justify-center sm:flex">
      <div className="portfolio-ring-one absolute h-[96px] w-[126px] rounded-[50%] border border-td-accent/[0.15]" />
      <div className="portfolio-ring-two absolute h-[72px] w-[112px] rounded-[50%] border border-td-accent/[0.16]" />
      <div className="absolute h-[88px] w-[88px] rounded-full bg-td-accent/[0.09] blur-2xl" />
      <Image
        src="/brand/trading-docks-mark.png"
        alt=""
        width={1024}
        height={1024}
        className="portfolio-logo relative h-[86px] w-[86px] object-contain drop-shadow-[0_0_24px_rgb(var(--td-accent-rgb)/0.22)]"
      />
    </div>
  );
}

function HeroBadge({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-td-accent/[0.2] bg-td-accent/[0.055] px-3.5 py-1.5 text-[11px] font-semibold text-td-accent-text shadow-[0_0_24px_rgb(var(--td-accent-rgb)/0.045)] transition duration-300 hover:border-td-accent/[0.35] hover:bg-td-accent/[0.09] hover:shadow-[0_0_28px_rgb(var(--td-accent-rgb)/0.09)]">
      <Icon className="h-3.5 w-3.5 text-td-accent-text" />
      {label}
    </div>
  );
}

function HeroStatus({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="group/status flex items-center gap-2 text-xs text-td-secondary">
      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-td-accent/[0.14] bg-td-accent/[0.045] transition duration-300 group-hover/status:border-td-accent/[0.28] group-hover/status:bg-td-accent/[0.09] group-hover/status:shadow-[0_0_15px_rgb(var(--td-accent-rgb)/0.08)]">
        <Icon className="h-3 w-3 text-td-accent-text" />
      </div>

      {label}
    </div>
  );
}

function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_40%,rgb(var(--td-accent-rgb)/0.065),transparent_27%),radial-gradient(circle_at_100%_0%,rgb(var(--td-accent-rgb)/0.07),transparent_36%),radial-gradient(circle_at_10%_0%,rgb(var(--td-accent-rgb)/0.035),transparent_30%)]" />

      <div
        className="absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--td-accent-rgb)/0.022) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--td-accent-rgb)/0.022) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage:
            "linear-gradient(to right, transparent, black 52%, black)",
        }}
      />

      <div className="absolute inset-x-28 top-0 h-px bg-gradient-to-r from-transparent via-td-accent/45 to-transparent" />

      <div className="absolute bottom-[-140px] right-[3%] h-80 w-80 rounded-full bg-td-accent/[0.045] blur-[120px]" />

      <div className="absolute right-[-80px] top-[-110px] h-80 w-80 rounded-full bg-td-accent/[0.04] blur-[130px]" />
    </div>
  );
}
