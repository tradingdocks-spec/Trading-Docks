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
      "from-td-accent/[0.10] via-td-accent/[0.035] to-transparent",
    centerGlow:
      "bg-td-accent/[0.025]",
    edgeGlow:
      "via-td-accent/35",
    progress:
      "from-td-accent via-td-accent to-td-accent",
    pulse:
      "bg-td-accent/25",
  },

  saving: {
    topGlow:
      "from-td-accent/[0.13] via-td-accent/[0.04] to-transparent",
    centerGlow:
      "bg-td-accent/[0.035]",
    edgeGlow:
      "via-td-accent/50",
    progress:
      "from-td-accent via-td-accent to-td-accent",
    pulse:
      "bg-td-accent/30",
  },

  syncing: {
    topGlow:
      "from-td-warning/[0.13] via-td-warning/[0.035] to-transparent",
    centerGlow:
      "bg-td-warning/[0.03]",
    edgeGlow:
      "via-td-warning/50",
    progress:
      "from-td-warning via-td-warning to-td-warning",
    pulse:
      "bg-td-warning/30",
  },

  importing: {
    topGlow:
      "from-td-success/[0.14] via-td-accent/[0.04] to-transparent",
    centerGlow:
      "bg-td-success/[0.035]",
    edgeGlow:
      "via-td-success/50",
    progress:
      "from-td-success via-td-accent to-td-success",
    pulse:
      "bg-td-success/30",
  },

  processing: {
    topGlow:
      "from-td-violet/[0.14] via-fuchsia-400/[0.035] to-transparent",
    centerGlow:
      "bg-td-violet/[0.035]",
    edgeGlow:
      "via-td-violet/50",
    progress:
      "from-td-violet via-fuchsia-300 to-td-violet",
    pulse:
      "bg-td-violet/30",
  },

  success: {
    topGlow:
      "from-td-success/[0.15] via-td-accent/[0.04] to-transparent",
    centerGlow:
      "bg-td-success/[0.04]",
    edgeGlow:
      "via-td-success/60",
    progress:
      "from-td-success via-td-accent to-td-success",
    pulse:
      "bg-td-success/35",
  },

  warning: {
    topGlow:
      "from-td-warning/[0.16] via-td-warning/[0.045] to-transparent",
    centerGlow:
      "bg-td-warning/[0.04]",
    edgeGlow:
      "via-td-warning/60",
    progress:
      "from-td-warning via-td-warning to-td-warning",
    pulse:
      "bg-td-warning/35",
  },

  offline: {
    topGlow:
      "from-td-danger/[0.18] via-td-danger/[0.045] to-transparent",
    centerGlow:
      "bg-td-danger/[0.045]",
    edgeGlow:
      "via-td-danger/65",
    progress:
      "from-td-danger via-td-danger to-td-danger",
    pulse:
      "bg-td-danger/40",
  },

  critical: {
    topGlow:
      "from-td-danger/[0.22] via-td-danger/[0.055] to-transparent",
    centerGlow:
      "bg-td-danger/[0.055]",
    edgeGlow:
      "via-td-danger/75",
    progress:
      "from-td-danger via-td-danger to-td-danger",
    pulse:
      "bg-td-danger/45",
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