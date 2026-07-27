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
    <section className="rounded-[28px] border border-white/[0.085] bg-[#06121b]/82 p-5 shadow-[0_26px_85px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Workspace
        </p>

        <h2 className="mt-2 text-lg font-semibold text-white">
          Quick actions
        </h2>

        <p className="mt-1 text-xs text-slate-500">
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
              className="group relative min-h-[140px] overflow-hidden rounded-[20px] border border-white/[0.07] bg-black/[0.12] p-4 transition duration-400 hover:-translate-y-1 hover:border-cyan-300/[0.18] hover:bg-white/[0.025] hover:shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
            >
              <div
                className={[
                  "pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full blur-[55px] transition duration-500",
                  isViolet
                    ? "bg-violet-500/[0.045] group-hover:bg-violet-500/[0.09]"
                    : "bg-cyan-400/[0.045] group-hover:bg-cyan-400/[0.09]",
                ].join(" ")}
              />

              <div className="relative flex items-start justify-between gap-4">
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-2xl border transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105",
                    isViolet
                      ? "border-violet-300/[0.14] bg-violet-500/[0.07] text-violet-300 group-hover:border-violet-300/30 group-hover:bg-violet-500/[0.12]"
                      : "border-cyan-300/[0.14] bg-cyan-400/[0.07] text-cyan-300 group-hover:border-cyan-300/30 group-hover:bg-cyan-400/[0.12]",
                  ].join(" ")}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <ArrowUpRight className="h-4 w-4 text-slate-700 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              </div>

              <h3 className="relative mt-5 text-sm font-semibold text-slate-200 transition group-hover:text-white">
                {action.title}
              </h3>

              <p className="relative mt-2 text-xs leading-5 text-slate-600 transition group-hover:text-slate-500">
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}