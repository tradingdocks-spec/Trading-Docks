import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Check,
  CircleCheck,
  Database,
  Gem,
  Layers3,
  LockKeyhole,
  Mail,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";

import { signUp } from "@/app/actions/auth";
import { TradingDocksMark } from "@/components/brand/trading-docks-logo";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
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
    <div className="group rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-cyan-400/[0.055]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 transition group-hover:border-cyan-300/40 group-hover:bg-cyan-400/15">
          {icon}
        </div>

        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-white">{title}</h3>

          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {description}
          </p>
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

          <p className="mt-0.5 text-[7px] text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export default async function SignUpPage({
  searchParams,
}: SignUpPageProps) {
  const { error, success } = await searchParams;

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

        @keyframes panelFloat {
          0%, 100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-4px);
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

        @keyframes sweep {
          0% {
            transform: translateX(-150%) skewX(-18deg);
          }

          68%, 100% {
            transform: translateX(350%) skewX(-18deg);
          }
        }

        @keyframes iconPulse {
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

        @keyframes progressGlow {
          0%, 100% {
            opacity: 0.6;
          }

          50% {
            opacity: 1;
          }
        }

        .ambient-glow {
          animation: ambientGlow 10s ease-in-out infinite;
        }

        .panel-float {
          animation: panelFloat 7.5s ease-in-out infinite;
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

        .panel-sweep {
          animation: sweep 8s ease-in-out infinite;
        }

        .signup-icon {
          animation: iconPulse 4s ease-in-out infinite;
        }

        .progress-glow {
          animation: progressGlow 3s ease-in-out infinite;
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
          .panel-float,
          .module-float-one,
          .module-float-two,
          .module-float-three,
          .panel-sweep,
          .signup-icon,
          .progress-glow {
            animation: none !important;
          }
        }
      `}</style>

      {/* Background grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.1]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.14) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
        }}
      />

      {/* Ambient glow */}
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

      <div className="desktop-scale relative mx-auto grid min-h-screen w-full max-w-[1360px] grid-cols-1 px-5 py-7 sm:px-8 lg:h-screen lg:min-h-0 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-12 lg:px-8 lg:py-4 xl:gap-16">
        {/* Left marketing section */}
        <section className="hidden h-full min-h-0 items-center lg:flex">
          <div className="w-full max-w-[640px]">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                aria-label="Return to Trading Docks home"
                className="inline-flex items-center gap-2.5"
              >
                <TradingDocksMark className="h-8 w-8" />

                <span className="text-xs font-semibold tracking-wide text-white">
                  Trading Docks
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

            <h1 className="mt-4 max-w-[630px] text-[clamp(2.45rem,3.8vw,3.8rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-white">
              Build your complete
              <span className="mt-1 block bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-500 bg-clip-text text-transparent">
                collectibles workspace.
              </span>
            </h1>

            <p className="mt-3 max-w-[610px] text-xs leading-5 text-slate-400 xl:text-sm">
              Create one connected home for singles, sealed products, graded
              cards, binders, bulk inventory, marketplace listings, sorting
              tools, pricing, sales, and business operations.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <FeatureCard
                icon={<Layers3 className="h-3.5 w-3.5" />}
                title="Set and Chaos Sort"
                description="Organize high-volume inventory faster."
              />

              <FeatureCard
                icon={<Search className="h-3.5 w-3.5" />}
                title="Find anything quickly"
                description="Search by card, set, binder, box, or location."
              />

              <FeatureCard
                icon={<Gem className="h-3.5 w-3.5" />}
                title="Every inventory type"
                description="Singles, slabs, sealed, supplies, and bulk."
              />

              <FeatureCard
                icon={<Boxes className="h-3.5 w-3.5" />}
                title="Built to scale"
                description="For collectors, growing sellers, and stores."
              />
            </div>

            <div className="relative mt-4">
              <div
                aria-hidden="true"
                className="ambient-glow pointer-events-none absolute -inset-8 rounded-[45px] bg-cyan-500/[0.1] blur-[65px]"
              />

              <FloatingModule
                className="-left-10 top-9 module-float-one"
                eyebrow="Account setup"
                title="Collection profile"
                detail="Personalized workspace"
                icon={<UserRound className="h-3.5 w-3.5" />}
              />

              <FloatingModule
                className="-right-8 top-14 module-float-two"
                eyebrow="Inventory setup"
                title="Storage locations"
                detail="Binders, boxes, and shelves"
                icon={<Database className="h-3.5 w-3.5" />}
              />

              <FloatingModule
                className="-bottom-4 left-20 module-float-three"
                eyebrow="Ready to organize"
                title="Chaos Sort"
                detail="Fast inventory intake"
                icon={<Sparkles className="h-3.5 w-3.5" />}
              />

              <div className="panel-float relative rounded-[20px] border border-cyan-300/20 bg-white/[0.04] p-1 shadow-[0_24px_75px_rgba(0,0,0,0.5),0_0_45px_rgba(34,211,238,0.09)] backdrop-blur-xl">
                <div className="panel-sweep pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />

                <div className="relative overflow-hidden rounded-[16px] border border-white/[0.08] bg-[#071017]/95 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[7px] font-medium uppercase tracking-[0.16em] text-slate-500">
                        Workspace setup
                      </p>

                      <p className="mt-0.5 text-sm font-semibold text-white">
                        Your Trading Docks account
                      </p>
                    </div>

                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] p-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                        <UserRound className="h-3.5 w-3.5" />
                      </div>

                      <p className="mt-3 text-[10px] font-semibold text-white">
                        Create account
                      </p>

                      <p className="mt-1 text-[8px] leading-3 text-slate-500">
                        Add your basic account information.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-slate-400">
                        <Layers3 className="h-3.5 w-3.5" />
                      </div>

                      <p className="mt-3 text-[10px] font-semibold text-white">
                        Choose tools
                      </p>

                      <p className="mt-1 text-[8px] leading-3 text-slate-500">
                        Select inventory and business modules.
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-slate-400">
                        <CircleCheck className="h-3.5 w-3.5" />
                      </div>

                      <p className="mt-3 text-[10px] font-semibold text-white">
                        Start organizing
                      </p>

                      <p className="mt-1 text-[8px] leading-3 text-slate-500">
                        Import or build your first inventory.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] font-medium uppercase tracking-[0.14em] text-slate-500">
                        Account setup progress
                      </p>

                      <span className="text-[8px] font-semibold text-cyan-300">
                        Step 1 of 3
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="progress-glow h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.45)]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 text-[8px] text-slate-600">
              <span>© 2026 Trading Docks</span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span>Collectibles inventory and operations</span>
            </div>
          </div>
        </section>

        {/* Sign-up section */}
        <section className="flex w-full items-center justify-center lg:h-full lg:min-h-0">
          <div className="w-full max-w-[420px]">
            <Link
              href="/"
              className="mb-6 flex items-center justify-center gap-3 lg:hidden"
            >
              <TradingDocksMark className="h-9 w-9" />

              <span className="text-base font-semibold text-white">
                Trading Docks
              </span>
            </Link>

            <div className="panel-float relative">
              <div
                aria-hidden="true"
                className="ambient-glow pointer-events-none absolute -inset-9 rounded-[50px] bg-cyan-500/[0.11] blur-[65px]"
              />

              <div className="relative rounded-[26px] border border-cyan-300/20 bg-white/[0.04] p-1 shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_50px_rgba(34,211,238,0.09)] backdrop-blur-2xl">
                <div className="panel-sweep pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-transparent via-white/[0.035] to-transparent" />

                <div className="relative overflow-hidden rounded-[21px] border border-white/[0.08] bg-[#071017]/95 px-6 py-5">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-cyan-400/[0.08] blur-3xl"
                  />

                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="signup-icon flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                        <UserRound className="h-4 w-4" />
                      </div>

                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[8px] font-medium text-slate-400">
                        <ShieldCheck className="h-2.5 w-2.5 text-cyan-300" />
                        Secure registration
                      </span>
                    </div>

                    <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
                      Create your account
                    </h2>

                    <p className="mt-1.5 text-xs leading-5 text-slate-400">
                      Start building your connected collection, inventory, and
                      business workspace.
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
                        className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2.5 text-xs leading-5 text-emerald-200"
                      >
                        <div className="flex items-start gap-2">
                          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{success}</span>
                        </div>
                      </div>
                    ) : null}

                    {!success ? (
                      <form action={signUp} className="mt-4 space-y-3">
                        <div>
                          <label
                            htmlFor="name"
                            className="mb-1 block text-[10px] font-medium text-slate-200"
                          >
                            Full name
                          </label>

                          <div className="relative">
                            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />

                            <input
                              id="name"
                              name="name"
                              type="text"
                              autoComplete="name"
                              required
                              placeholder="Your name"
                              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-10 pr-3.5 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-400/50 focus:bg-cyan-400/[0.035] focus:ring-4 focus:ring-cyan-400/10"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="email"
                            className="mb-1 block text-[10px] font-medium text-slate-200"
                          >
                            Email address
                          </label>

                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />

                            <input
                              id="email"
                              name="email"
                              type="email"
                              autoComplete="email"
                              required
                              placeholder="you@example.com"
                              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-10 pr-3.5 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-400/50 focus:bg-cyan-400/[0.035] focus:ring-4 focus:ring-cyan-400/10"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="password"
                            className="mb-1 block text-[10px] font-medium text-slate-200"
                          >
                            Password
                          </label>

                          <div className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />

                            <input
                              id="password"
                              name="password"
                              type="password"
                              autoComplete="new-password"
                              required
                              minLength={8}
                              placeholder="At least 8 characters"
                              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-10 pr-3.5 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-400/50 focus:bg-cyan-400/[0.035] focus:ring-4 focus:ring-cyan-400/10"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="confirmPassword"
                            className="mb-1 block text-[10px] font-medium text-slate-200"
                          >
                            Confirm password
                          </label>

                          <div className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />

                            <input
                              id="confirmPassword"
                              name="confirmPassword"
                              type="password"
                              autoComplete="new-password"
                              required
                              minLength={8}
                              placeholder="Enter your password again"
                              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-10 pr-3.5 text-xs text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-400/50 focus:bg-cyan-400/[0.035] focus:ring-4 focus:ring-cyan-400/10"
                            />
                          </div>
                        </div>

                        <label className="flex items-start gap-2.5 text-[9px] leading-4 text-slate-500">
                          <input
                            name="terms"
                            type="checkbox"
                            required
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-white/[0.035] accent-cyan-400"
                          />

                          <span>
                            I agree to the{" "}
                            <Link
                              href="/terms"
                              className="font-medium text-cyan-300 transition hover:text-cyan-200"
                            >
                              Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link
                              href="/privacy"
                              className="font-medium text-cyan-300 transition hover:text-cyan-200"
                            >
                              Privacy Policy
                            </Link>
                            .
                          </span>
                        </label>

                        <button
                          type="submit"
                          className="group flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-300 px-4 text-xs font-semibold text-slate-950 shadow-[0_10px_26px_rgba(6,182,212,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(6,182,212,0.36)] focus:outline-none focus:ring-4 focus:ring-cyan-400/20"
                        >
                          Create account
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                        </button>
                      </form>
                    ) : (
                      <Link
                        href="/sign-in"
                        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-300 px-4 text-xs font-semibold text-slate-950 shadow-[0_10px_26px_rgba(6,182,212,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(6,182,212,0.36)]"
                      >
                        Continue to sign in
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}

                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />

                      <span className="text-[9px] text-slate-500">
                        Already have an account?
                      </span>

                      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                    </div>

                    <Link
                      href="/sign-in"
                      className="flex h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-cyan-400/[0.07]"
                    >
                      Sign in
                    </Link>

                    <div className="mt-4 flex items-center justify-center gap-2 text-[8px] text-slate-500">
                      <Check className="h-3 w-3 text-cyan-400" />
                      Account security powered by Supabase
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