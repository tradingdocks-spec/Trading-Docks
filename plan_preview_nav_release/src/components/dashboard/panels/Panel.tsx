import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Panel({
  children,
  className = "",
  padding = "lg",
  interactive = false,
}: PanelProps) {
  return (
    <section
      className={[
        "group relative overflow-hidden rounded-3xl",
        "border border-white/[0.07]",
        "bg-white/[0.025]",
        "shadow-[0_22px_70px_rgba(0,0,0,0.18)]",
        "backdrop-blur-xl",
        "transition-all duration-300",
        interactive
          ? "hover:-translate-y-0.5 hover:border-white/[0.11] hover:bg-white/[0.04]"
          : "",
        paddingClasses[padding],
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/[0.035] blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      <div className="relative">{children}</div>
    </section>
  );
}