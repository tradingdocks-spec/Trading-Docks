export function BackgroundEffects() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#02090f]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(37,99,235,0.11),transparent_28%),radial-gradient(circle_at_82%_26%,rgba(14,116,144,0.08),transparent_30%),linear-gradient(180deg,#02090f_0%,#031019_52%,#02080d_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.035) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "linear-gradient(to bottom, black, transparent 86%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 86%)",
        }}
      />
      <div className="absolute left-[7%] top-20 h-[460px] w-[460px] rounded-full bg-blue-400/[0.06] blur-[150px]" />
      <div className="absolute right-[-10%] top-[24%] h-[580px] w-[580px] rounded-full bg-sky-600/[0.06] blur-[180px]" />
    </div>
  );
}
