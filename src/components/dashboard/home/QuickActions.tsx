import {
  ArrowUpRight,
  Barcode,
  FileUp,
  PackagePlus,
  ScanLine,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import Link from "next/link";

const actions = [
  {
    title: "Scan cards",
    description:
      "Start a new card scanning and identification session.",
    href: "/dashboard/inventory/scan",
    icon: ScanLine,
    accent: "cyan",
  },
  {
    title: "Create listing",
    description:
      "Publish an inventory item to a connected marketplace.",
    href: "/dashboard/marketplaces/listings/new",
    icon: Tags,
    accent: "violet",
  },
  {
    title: "Import inventory",
    description:
      "Upload a CSV or bring in inventory from another system.",
    href: "/dashboard/inventory/import",
    icon: FileUp,
    accent: "cyan",
  },
  {
    title: "Run repricing",
    description:
      "Review current market prices and update selected listings.",
    href: "/dashboard/automation/repricing",
    icon: SlidersHorizontal,
    accent: "violet",
  },
  {
    title: "Add product",
    description:
      "Create a new inventory item manually.",
    href: "/dashboard/inventory/new",
    icon: PackagePlus,
    accent: "cyan",
  },
  {
    title: "Print labels",
    description:
      "Prepare barcode and location labels for inventory.",
    href: "/dashboard/inventory/labels",
    icon: Barcode,
    accent: "violet",
  },
];

export function QuickActions() {
  return (
    <section className="rounded-[28px] border border-td-ink/[0.085] bg-td-surface/82 p-5 shadow-[0_26px_85px_rgb(var(--td-shadow-rgb)/calc(0.28*var(--td-shadow-strength)))] backdrop-blur-2xl sm:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
          Workspace
        </p>

        <h2 className="mt-2 text-lg font-semibold text-td-primary">
          Quick actions
        </h2>

        <p className="mt-1 text-xs text-td-muted">
          Jump directly into your most common workflows.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const isViolet = action.accent === "violet";

          return (
            <Link
              key={action.title}
              href={action.href}
              className="group relative min-h-[140px] overflow-hidden rounded-[20px] border border-td-ink/[0.07] bg-black/[0.12] p-4 transition duration-400 hover:-translate-y-1 hover:border-td-accent/[0.18] hover:bg-td-ink/[0.025] hover:shadow-[0_18px_45px_rgb(var(--td-shadow-rgb)/calc(0.28*var(--td-shadow-strength)))]"
            >
              <div
                className={[
                  "pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full blur-[55px] transition duration-500",
                  isViolet
                    ? "bg-td-violet/[0.045] group-hover:bg-td-violet/[0.09]"
                    : "bg-td-accent/[0.045] group-hover:bg-td-accent/[0.09]",
                ].join(" ")}
              />

              <div className="relative flex items-start justify-between gap-4">
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-2xl border transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105",
                    isViolet
                      ? "border-td-violet/[0.14] bg-td-violet/[0.07] text-td-violet group-hover:border-td-violet/30 group-hover:bg-td-violet/[0.12]"
                      : "border-td-accent/[0.14] bg-td-accent/[0.07] text-td-accent-text group-hover:border-td-accent/30 group-hover:bg-td-accent/[0.12]",
                  ].join(" ")}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <ArrowUpRight className="h-4 w-4 text-td-muted transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-td-accent-text" />
              </div>

              <h3 className="relative mt-5 text-sm font-semibold text-td-primary transition group-hover:text-td-primary">
                {action.title}
              </h3>

              <p className="relative mt-2 text-xs leading-5 text-td-muted transition group-hover:text-td-muted">
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}