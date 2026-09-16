export function BackgroundEffects() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-td-canvas">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgb(var(--td-accent-rgb)/0.11),transparent_28%),radial-gradient(circle_at_82%_26%,rgb(var(--td-accent-rgb)/0.08),transparent_30%),linear-gradient(180deg,var(--td-surface-default)_0%,var(--td-surface-default)_52%,var(--td-surface-default)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--td-accent-rgb)/0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--td-accent-rgb)/0.035) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "linear-gradient(to bottom, black, transparent 86%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 86%)",
        }}
      />
      <div className="absolute left-[7%] top-20 h-[460px] w-[460px] rounded-full bg-td-accent/[0.06] blur-[150px]" />
      <div className="absolute right-[-10%] top-[24%] h-[580px] w-[580px] rounded-full bg-td-accent/[0.06] blur-[180px]" />
    </div>
  );
}
