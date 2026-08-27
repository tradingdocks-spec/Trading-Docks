"use client";

import Link from "next/link";
import { ArrowLeft, FileUp, MapPin } from "lucide-react";

import { CsvConversionEngine } from "@/components/dashboard/tools/CsvConversionEngine";

export function InventoryImportWorkspace({
  initialLocationId = "",
  initialLocationName = "Unassigned",
}: {
  initialLocationId?: string;
  initialLocationName?: string;
}) {
  return (
    <main className="min-h-screen bg-[#020911] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] space-y-4">
        <Link href="/dashboard/inventory" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-slate-300 transition hover:border-cyan-300/25 hover:text-cyan-100">
          <ArrowLeft className="h-4 w-4" />
          Inventory
        </Link>
        <section className="rounded-[28px] border border-white/[0.08] bg-[#06131d] p-5 shadow-[0_22px_90px_rgba(0,0,0,.28)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/80">Inventory Intake</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">Upload CSV</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Parse an inventory spreadsheet, map fields, confirm condition and finish, choose a physical destination, then save reviewed rows into Collection.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] px-4 py-3">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-200/75"><MapPin className="h-3.5 w-3.5" /> Import into</p>
              <p className="mt-1 max-w-[320px] truncate text-sm font-semibold text-cyan-50">{initialLocationName || "Unassigned"}</p>
            </div>
          </div>
        </section>
        <CsvConversionEngine
          initialDestination="inventory"
          initialLocationId={initialLocationId}
          initialLocationName={initialLocationName || "Unassigned"}
        />
        <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400"><FileUp className="h-4 w-4" /> Review before finalizing</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            CSV rows are loaded into review first. Inventory is not mutated until you choose Save into Trading Docks from the reviewed result.
          </p>
        </section>
      </div>
    </main>
  );
}
