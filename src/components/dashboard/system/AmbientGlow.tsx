"use client";

import type {
  SystemActivity,
  SystemTone,
} from "./types";

type AmbientGlowProps = {
  tone: SystemTone;
  activity: SystemActivity | null;
};

type ToneStyle = {
  topGlow: string;
  centerGlow: string;
  edgeGlow: string;
  progress: string;
  pulse: string;
};

const toneStyles: Record<SystemTone, ToneStyle> = {
  default: {
    topGlow:
      "from-cyan-400/[0.10] via-sky-400/[0.035] to-transparent",
    centerGlow:
      "bg-cyan-400/[0.025]",
    edgeGlow:
      "via-cyan-300/35",
    progress:
      "from-cyan-400 via-sky-300 to-cyan-400",
    pulse:
      "bg-cyan-300/25",
  },

  saving: {
    topGlow:
      "from-blue-400/[0.13] via-cyan-400/[0.04] to-transparent",
    centerGlow:
      "bg-blue-400/[0.035]",
    edgeGlow:
      "via-blue-300/50",
    progress:
      "from-blue-500 via-cyan-300 to-blue-400",
    pulse:
      "bg-blue-300/30",
  },

  syncing: {
    topGlow:
      "from-amber-400/[0.13] via-orange-400/[0.035] to-transparent",
    centerGlow:
      "bg-amber-400/[0.03]",
    edgeGlow:
      "via-amber-300/50",
    progress:
      "from-amber-500 via-yellow-300 to-orange-400",
    pulse:
      "bg-amber-300/30",
  },

  importing: {
    topGlow:
      "from-emerald-400/[0.14] via-teal-400/[0.04] to-transparent",
    centerGlow:
      "bg-emerald-400/[0.035]",
    edgeGlow:
      "via-emerald-300/50",
    progress:
      "from-emerald-500 via-teal-300 to-emerald-400",
    pulse:
      "bg-emerald-300/30",
  },

  processing: {
    topGlow:
      "from-violet-400/[0.14] via-fuchsia-400/[0.035] to-transparent",
    centerGlow:
      "bg-violet-400/[0.035]",
    edgeGlow:
      "via-violet-300/50",
    progress:
      "from-violet-500 via-fuchsia-300 to-indigo-400",
    pulse:
      "bg-violet-300/30",
  },

  success: {
    topGlow:
      "from-emerald-400/[0.15] via-cyan-400/[0.04] to-transparent",
    centerGlow:
      "bg-emerald-400/[0.04]",
    edgeGlow:
      "via-emerald-300/60",
    progress:
      "from-emerald-500 via-cyan-300 to-emerald-400",
    pulse:
      "bg-emerald-300/35",
  },

  warning: {
    topGlow:
      "from-orange-400/[0.16] via-amber-400/[0.045] to-transparent",
    centerGlow:
      "bg-orange-400/[0.04]",
    edgeGlow:
      "via-orange-300/60",
    progress:
      "from-orange-500 via-amber-300 to-orange-400",
    pulse:
      "bg-orange-300/35",
  },

  offline: {
    topGlow:
      "from-rose-500/[0.18] via-red-500/[0.045] to-transparent",
    centerGlow:
      "bg-rose-500/[0.045]",
    edgeGlow:
      "via-rose-300/65",
    progress:
      "from-rose-600 via-red-300 to-rose-500",
    pulse:
      "bg-rose-300/40",
  },

  critical: {
    topGlow:
      "from-red-600/[0.22] via-rose-500/[0.055] to-transparent",
    centerGlow:
      "bg-red-500/[0.055]",
    edgeGlow:
      "via-red-300/75",
    progress:
      "from-red-600 via-rose-300 to-red-500",
    pulse:
      "bg-red-300/45",
  },
};

export function AmbientGlow({
  tone,
  activity,
}: AmbientGlowProps) {
  const styles = toneStyles[tone];

  const hasProgress =
    typeof activity?.progress === "number";

  const isActive =
    tone !== "default" || activity !== null;

  return (
    <div
      aria-hidden="true"
      data-system-tone={tone}
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {/* Top ambient wash */}

      <div
        className={`absolute inset-x-0 top-0 h-[280px] bg-gradient-to-b transition-all duration-1000 ease-out ${styles.topGlow} ${
          isActive
            ? "opacity-100"
            : "opacity-70"
        }`}
      />

      {/* Large diffused glow */}

      <div
        className={`absolute left-1/2 top-[-220px] h-[520px] w-[75vw] -translate-x-1/2 rounded-full blur-[140px] transition-all duration-1000 ease-out ${styles.centerGlow} ${
          isActive
            ? "scale-110 opacity-100"
            : "scale-100 opacity-60"
        }`}
      />

      {/* Fine top-edge highlight */}

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div
        className={`absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-all duration-700 ${styles.edgeGlow} ${
          isActive
            ? "opacity-100"
            : "opacity-45"
        }`}
      />

      {/* Progress indicator */}

      {activity ? (
        <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-black/10">
          {hasProgress ? (
            <div
              className={`h-full bg-gradient-to-r shadow-[0_0_18px_currentColor] transition-[width] duration-500 ease-out ${styles.progress}`}
              style={{
                width: `${activity.progress}%`,
              }}
            />
          ) : (
            <div
              className={`system-progress-indeterminate h-full w-[32%] bg-gradient-to-r shadow-[0_0_18px_currentColor] ${styles.progress}`}
            />
          )}
        </div>
      ) : null}

      {/* Activity pulse */}

      {activity ? (
        <div className="absolute right-6 top-5">
          <div
            className={`h-2 w-2 rounded-full blur-[1px] ${styles.pulse} ${
              activity.indeterminate
                ? "animate-pulse"
                : ""
            }`}
          />
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes system-progress-indeterminate {
          0% {
            transform: translateX(-120%);
          }

          50% {
            transform: translateX(155%);
          }

          100% {
            transform: translateX(340%);
          }
        }

        .system-progress-indeterminate {
          animation: system-progress-indeterminate
            1.65s cubic-bezier(0.4, 0, 0.2, 1)
            infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .system-progress-indeterminate {
            animation-duration: 4s;
          }
        }
      `}</style>
    </div>
  );
}