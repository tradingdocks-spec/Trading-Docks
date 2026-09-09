import Link from "next/link";
import { BrandMark } from "./BrandMark";

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      ["Lifecycle", "#experience"],
      ["Platform", "#platform"],
      ["Market", "#market"],
      ["Pricing", "#pricing"],
    ],
  },
  {
    title: "Workspace",
    links: [
      ["Collection", "/sign-up?plan=collector"],
      ["Seller", "/sign-up?plan=seller"],
      ["Store", "/sign-up?plan=store"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Security", "/security"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-td-ink/[0.06] bg-td-canvas">
      <div className="mx-auto grid w-full max-w-[1480px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:px-12">
        <div>
          <BrandMark />
          <p className="mt-5 max-w-md text-sm leading-6 text-td-muted">
            Card intelligence, inventory control, and operating workflows for
            collectors, sellers, and stores.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-sm font-semibold text-td-secondary">{group.title}</h2>
              <div className="mt-4 grid gap-3">
                {group.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm text-td-muted transition hover:text-td-accent-text"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 border-t border-td-ink/[0.06] px-5 py-5 text-xs text-td-muted sm:flex-row sm:justify-between sm:px-8 lg:px-12">
        <span>Copyright 2026 Trading Docks. All rights reserved.</span>
        <span className="max-w-3xl">
          Trading Docks is independent and is not affiliated with or endorsed by
          the publishers or owners of supported trading-card games. Market values
          are estimates, not guaranteed sale prices.
        </span>
      </div>
    </footer>
  );
}
