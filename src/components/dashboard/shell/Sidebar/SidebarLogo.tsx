import Image from "next/image";

type SidebarLogoProps = {
  collapsed: boolean;
};

export function SidebarLogo({ collapsed }: SidebarLogoProps) {
  return (
    <div
      className={[
        "flex h-16 items-center border-b border-td-ink/[0.06]",
        collapsed ? "justify-center px-3" : "gap-3 px-4",
      ].join(" ")}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <div className="absolute inset-1 rounded-2xl bg-td-accent/[0.14] blur-xl" />
        <Image
          src="/brand/trading-docks-mark.png"
          alt=""
          width={1024}
          height={1024}
          priority
          className="relative h-10 w-10 object-contain drop-shadow-[0_0_14px_rgb(var(--td-accent-rgb)/0.18)]"
        />
      </div>

      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-td-primary">
            Trading Docks
          </p>
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.19em] text-td-accent-text/55">
            Collectibles OS
          </p>
        </div>
      ) : null}
    </div>
  );
}
