"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Boxes,
  BrainCircuit,
  Building2,
  CalendarRange,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileBarChart2,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  LineChart,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  TableProperties,
  Truck,
  Trophy,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

type ReportCategory =
  | "overview"
  | "financial"
  | "taxes"
  | "inventory"
  | "sales"
  | "marketplaces"
  | "shipping"
  | "employees"
  | "tournaments"
  | "insurance";

type ExportFormat = "PDF" | "Excel" | "CSV" | "JSON";

type SavedReport = {
  id: string;
  name: string;
  category: string;
  cadence: string;
  lastRun: string;
  format: ExportFormat;
};

type BuilderState = {
  name: string;
  dateRange: string;
  marketplaces: string[];
  metrics: string[];
  format: ExportFormat;
};

const CATEGORY_TABS: Array<{
  id: ReportCategory;
  label: string;
  icon: typeof FileBarChart2;
}> = [
  { id: "overview", label: "Overview", icon: FileBarChart2 },
  { id: "financial", label: "Financial", icon: CircleDollarSign },
  { id: "taxes", label: "Taxes", icon: Landmark },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "sales", label: "Sales Analytics", icon: LineChart },
  { id: "marketplaces", label: "Marketplaces", icon: Store },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "employees", label: "Employees", icon: Users },
  { id: "tournaments", label: "Tournaments", icon: Trophy },
  { id: "insurance", label: "Insurance", icon: ShieldCheck },
];

const REPORT_LIBRARY: Record<
  Exclude<ReportCategory, "overview">,
  Array<{
    title: string;
    description: string;
    icon: typeof FileBarChart2;
    badge?: string;
  }>
> = {
  financial: [
    { title: "Profit & Loss", description: "Revenue, COGS, operating expenses, and net profit.", icon: FileBarChart2, badge: "Popular" },
    { title: "Balance Sheet", description: "Assets, liabilities, inventory, and owner equity.", icon: TableProperties },
    { title: "Cash Flow", description: "Cash generated and spent across operating activities.", icon: Activity },
    { title: "Revenue Report", description: "Gross and net sales across selected periods.", icon: CircleDollarSign },
    { title: "Gross Profit", description: "Revenue less card and sealed-product acquisition cost.", icon: BadgeDollarSign },
    { title: "Expense Summary", description: "Shipping, supplies, fees, payroll, rent, and utilities.", icon: ReceiptText },
    { title: "Cost of Goods Sold", description: "Inventory acquisition costs matched against completed sales.", icon: ShoppingBag },
    { title: "Marketplace Fees", description: "Selling fees, processing fees, commissions, and subscriptions.", icon: WalletCards },
    { title: "Refunds & Discounts", description: "Returns, refunds, promotions, gift cards, and store credit.", icon: RefreshCw },
  ],
  taxes: [
    { title: "Sales Tax by State", description: "Tax collected and taxable sales grouped by jurisdiction.", icon: Landmark, badge: "Accountant ready" },
    { title: "Tax Liability", description: "Estimated tax owed after marketplace-facilitator adjustments.", icon: CircleDollarSign },
    { title: "Marketplace Facilitator", description: "Taxes collected and remitted by each marketplace.", icon: Store },
    { title: "Quarterly Tax Summary", description: "Quarterly taxable revenue, collected tax, and estimated liability.", icon: CalendarRange },
    { title: "Year-End Tax Package", description: "Annual sales, fees, expenses, inventory, and tax summary.", icon: FileText },
    { title: "1099-K Reconciliation", description: "Compare marketplace tax forms against platform transactions.", icon: ClipboardCheck },
    { title: "Estimated Taxes", description: "Planning estimate based on profit and selected assumptions.", icon: BadgeDollarSign },
    { title: "Tax Export", description: "Accountant-friendly transaction and tax CSV export.", icon: FileSpreadsheet },
  ],
  inventory: [
    { title: "Inventory Value", description: "Current market value, cost basis, and replacement value.", icon: Boxes, badge: "Live" },
    { title: "Inventory Growth", description: "Value and unit growth across selected time periods.", icon: LineChart },
    { title: "Cards Added & Sold", description: "Acquisitions, listings, completed sales, and net unit change.", icon: PackageCheck },
    { title: "Aging Inventory", description: "Inventory grouped by days held and last marketplace activity.", icon: CalendarRange },
    { title: "Dead Inventory", description: "Items without a sale or price movement beyond your threshold.", icon: Activity },
    { title: "Appreciation Leaders", description: "Cards and sealed products with the strongest value gains.", icon: BarChart3 },
    { title: "Biggest Decliners", description: "Inventory with the largest dollar or percentage losses.", icon: LineChart },
    { title: "Reserved List Holdings", description: "Reserved List cost basis, market value, and appreciation.", icon: ShieldCheck },
    { title: "Sealed & Graded Inventory", description: "Separate reporting for sealed, PSA, BGS, and CGC inventory.", icon: Boxes },
    { title: "Binder & Bulk Value", description: "Portfolio totals grouped by binder, box, shelf, or bulk location.", icon: TableProperties },
  ],
  sales: [
    { title: "Sales by Marketplace", description: "Gross sales, fees, shipping, and net revenue by channel.", icon: Store, badge: "Live" },
    { title: "Sales by Set", description: "Revenue, units, and profit grouped by trading-card set.", icon: Boxes },
    { title: "Sales by Color", description: "Magic sales grouped by color identity and color combination.", icon: BarChart3 },
    { title: "Sales by Card Type", description: "Creatures, artifacts, lands, trainers, energy, and other types.", icon: TableProperties },
    { title: "Sales by Rarity", description: "Revenue and unit velocity by rarity.", icon: Sparkles },
    { title: "Sales by Condition", description: "Near Mint, Lightly Played, Moderately Played, and Damaged.", icon: ClipboardCheck },
    { title: "Customer Report", description: "Repeat customers, lifetime value, average order, and location.", icon: Users },
    { title: "Daily & Monthly Sales", description: "Trend reporting with day, week, month, quarter, and year views.", icon: LineChart },
    { title: "Best-Selling Cards", description: "Top cards by quantity, gross revenue, and net profit.", icon: Trophy },
    { title: "Sales Heat Map", description: "Identify the strongest days and hours for completed orders.", icon: Activity },
  ],
  marketplaces: [
    { title: "TCGplayer Performance", description: "Gross sales, fees, shipping, refunds, and net profit.", icon: Store, badge: "Connected" },
    { title: "eBay Performance", description: "Orders, promoted listings, fees, shipping, and returns.", icon: Store },
    { title: "Shopify Performance", description: "Store revenue, conversion, discounts, and customer retention.", icon: Store },
    { title: "Mana Pool Performance", description: "Sales, fees, price competitiveness, and order value.", icon: Store },
    { title: "Whatnot Performance", description: "Auction revenue, giveaways, fees, and show profitability.", icon: Store },
    { title: "CardTrader Performance", description: "International sales, fees, shipping, and settlement totals.", icon: Store },
    { title: "Facebook & Direct Sales", description: "Manually tracked social and local transactions.", icon: Users },
    { title: "Channel Comparison", description: "Compare net profit, order value, velocity, and fee burden.", icon: BarChart3 },
  ],
  shipping: [
    { title: "Average Shipping Cost", description: "Average postage, supplies, and total fulfillment cost.", icon: Truck },
    { title: "Pirate Ship Spend", description: "Postage purchases and service mix from Pirate Ship.", icon: Truck },
    { title: "Carrier Summary", description: "USPS, UPS, FedEx, and local delivery costs and performance.", icon: Truck },
    { title: "Lost Packages", description: "Missing, delayed, damaged, and refunded shipment records.", icon: Activity },
    { title: "Shipping Claims", description: "Filed claims, recovered amounts, and unresolved losses.", icon: ShieldCheck },
    { title: "Delivery Time", description: "Average transit time by carrier, service, and destination.", icon: CalendarRange },
    { title: "Packaging Usage", description: "Mailers, labels, top loaders, sleeves, and boxes consumed.", icon: PackageCheck },
    { title: "Shipping Profitability", description: "Collected shipping compared with actual fulfillment expense.", icon: BadgeDollarSign },
  ],
  employees: [
    { title: "Hours Worked", description: "Regular, overtime, PTO, and unpaid time by employee.", icon: Users },
    { title: "Productivity", description: "Cards processed, listings created, and orders packed per hour.", icon: Activity, badge: "Business plan" },
    { title: "Cards Processed", description: "Scanned, identified, conditioned, priced, and staged inventory.", icon: Boxes },
    { title: "Orders Packed", description: "Fulfillment volume, error rate, and average handling time.", icon: PackageCheck },
    { title: "Payroll History", description: "Gross wages, payroll taxes, reimbursements, and deductions.", icon: CircleDollarSign },
    { title: "Attendance", description: "Clock-ins, late arrivals, absences, schedule adherence, and PTO.", icon: CalendarRange },
    { title: "Labor Cost by Activity", description: "Labor allocated to scanning, pricing, listing, and shipping.", icon: WalletCards },
    { title: "Team Capacity", description: "Scheduled workload compared with available labor hours.", icon: Users },
  ],
  tournaments: [
    { title: "Attendance", description: "Registrations, attendance rate, no-shows, and capacity.", icon: Users },
    { title: "Tournament Revenue", description: "Entry fees, concessions, product sales, and total revenue.", icon: CircleDollarSign },
    { title: "Event Profitability", description: "Revenue less prize support, staffing, product, and venue cost.", icon: BadgeDollarSign },
    { title: "Prize Support", description: "Cash, sealed product, singles, store credit, and promotional items.", icon: Trophy },
    { title: "Judge & Staff Hours", description: "Event labor hours and associated payroll cost.", icon: Users },
    { title: "Winners & Standings", description: "Final results, prizes, records, and season points.", icon: Trophy },
    { title: "Deck Archetypes", description: "Deck popularity, conversion rate, and top-performing archetypes.", icon: BarChart3 },
    { title: "Format Popularity", description: "Attendance and revenue by Commander, Standard, Modern, and more.", icon: Activity },
  ],
  insurance: [
    { title: "Complete Inventory Schedule", description: "Current inventory with quantities, values, cost basis, and locations.", icon: ShieldCheck, badge: "Flagship" },
    { title: "Replacement Cost Report", description: "Estimated cost to replace inventory at current market pricing.", icon: CircleDollarSign },
    { title: "High-Value Inventory", description: "Items grouped above $100, $500, $1,000, and custom thresholds.", icon: Sparkles },
    { title: "Graded Card Schedule", description: "PSA, BGS, and CGC cards with grades, cert numbers, and values.", icon: ClipboardCheck },
    { title: "Photo Documentation", description: "Inventory photos linked to item records and storage locations.", icon: FileText },
    { title: "Purchase Documentation", description: "Receipts, invoices, transaction history, and acquisition dates.", icon: ReceiptText },
    { title: "Location Schedule", description: "Inventory totals by store, office, storage unit, safe, or binder.", icon: Building2 },
    { title: "Loss Documentation Package", description: "Professional report for fire, water, theft, or other losses.", icon: ShieldCheck },
  ],
};

const MARKETPLACE_ROWS = [
  { channel: "TCGplayer", gross: 228440, fees: 29780, shipping: 18250, net: 180410, orders: 4312 },
  { channel: "eBay", gross: 108120, fees: 15140, shipping: 11200, net: 81780, orders: 1458 },
  { channel: "Shopify", gross: 76280, fees: 2280, shipping: 8340, net: 65660, orders: 922 },
  { channel: "Mana Pool", gross: 49340, fees: 3947, shipping: 4820, net: 40573, orders: 618 },
  { channel: "Direct", gross: 19934, fees: 820, shipping: 1440, net: 17674, orders: 194 },
];

const MONTHLY_REVENUE = [
  29400, 31800, 35100, 33800, 37400, 39200, 41800, 40500, 42900, 45300, 46800, 48200,
];

const INITIAL_SAVED_REPORTS: SavedReport[] = [
  { id: "1", name: "Weekly Sales", category: "Sales", cadence: "Every Monday", lastRun: "Jul 20, 2026", format: "Excel" },
  { id: "2", name: "Monthly Taxes", category: "Taxes", cadence: "Monthly", lastRun: "Jul 1, 2026", format: "CSV" },
  { id: "3", name: "Quarterly P&L", category: "Financial", cadence: "Quarterly", lastRun: "Jun 30, 2026", format: "PDF" },
  { id: "4", name: "Insurance Inventory", category: "Insurance", cadence: "On demand", lastRun: "Jul 18, 2026", format: "PDF" },
];

const DEFAULT_BUILDER: BuilderState = {
  name: "Custom Business Report",
  dateRange: "Year to date",
  marketplaces: ["TCGplayer", "eBay"],
  metrics: ["Revenue", "Fees", "Shipping", "Taxes", "Net Profit"],
  format: "PDF",
};

export function ReportsWorkspace() {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>("overview");
  const [period, setPeriod] = useState("Year to date");
  const [search, setSearch] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [savedReports, setSavedReports] = useState(INITIAL_SAVED_REPORTS);
  const [toast, setToast] = useState("");

  const currentReports = useMemo(() => {
    if (activeCategory === "overview") return [];
    return REPORT_LIBRARY[activeCategory].filter((report) =>
      `${report.title} ${report.description}`.toLowerCase().includes(search.toLowerCase()),
    );
  }, [activeCategory, search]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function exportReport(format: ExportFormat, reportName = "Business Intelligence Summary") {
    const rows = MARKETPLACE_ROWS.map((row) => ({
      marketplace: row.channel,
      gross_sales: row.gross,
      marketplace_fees: row.fees,
      shipping_expense: row.shipping,
      net_revenue: row.net,
      orders: row.orders,
    }));

    if (format === "PDF") {
      window.print();
      showToast("Print view opened for PDF export.");
      return;
    }

    if (format === "JSON") {
      downloadFile(
        `${slugify(reportName)}.json`,
        JSON.stringify(
          {
            report: reportName,
            generated_at: new Date().toISOString(),
            period,
            summary: {
              revenue: 482114,
              net_profit: 118322,
              expenses: 39420,
              sales_tax_owed: 7942,
              inventory_value: 482114,
              profit_margin: 27.8,
            },
            marketplace_performance: rows,
          },
          null,
          2,
        ),
        "application/json",
      );
      showToast("JSON report downloaded.");
      return;
    }

    const csv = [
      ["Marketplace", "Gross Sales", "Fees", "Shipping", "Net Revenue", "Orders"],
      ...MARKETPLACE_ROWS.map((row) => [
        row.channel,
        row.gross,
        row.fees,
        row.shipping,
        row.net,
        row.orders,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    downloadFile(
      `${slugify(reportName)}.${format === "Excel" ? "xls" : "csv"}`,
      format === "Excel"
        ? `<table>${csv
            .split("\n")
            .map(
              (line) =>
                `<tr>${line
                  .split(",")
                  .map((cell) => `<td>${cell}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}</table>`
        : csv,
      format === "Excel" ? "application/vnd.ms-excel" : "text/csv",
    );
    showToast(`${format} report downloaded.`);
  }

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Business Intelligence"
        title="Full reporting for every part of Trading Docks."
        description="Turn sales, inventory, taxes, expenses, shipping, employees, tournaments, and insurance documentation into polished reports and actionable insights."
        icon={FileBarChart2}
        actionLabel="Create report"
        onAction={() => setBuilderOpen(true)}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Revenue" value="$482,114" detail="+14.8% year to date" icon={CircleDollarSign} />
        <MetricCard label="Net profit" value="$118,322" detail="24.5% net margin" icon={BadgeDollarSign} />
        <MetricCard label="Expenses" value="$39,420" detail="+6.2% versus prior period" icon={ReceiptText} />
        <MetricCard label="Sales tax owed" value="$7,942" detail="After facilitator adjustments" icon={Landmark} />
        <MetricCard label="Inventory value" value="$482,114" detail="+$68,290 year to date" icon={Boxes} />
        <MetricCard label="Profit margin" value="27.8%" detail="+2.4 points year over year" icon={LineChart} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-3 sm:p-4`}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((category) => {
            const Icon = category.icon;
            const active = activeCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={[
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[9px] font-semibold transition",
                  active
                    ? "border-cyan-300/[0.18] bg-cyan-400/[0.075] text-cyan-100"
                    : "border-transparent text-slate-600 hover:border-white/[0.06] hover:bg-white/[0.025] hover:text-slate-300",
                ].join(" ")}
              >
                <Icon className={active ? "h-3.5 w-3.5 text-cyan-300" : "h-3.5 w-3.5"} />
                {category.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeCategory === "overview" ? (
        <OverviewDashboard
          period={period}
          setPeriod={setPeriod}
          savedReports={savedReports}
          onRun={(report) => exportReport(report.format, report.name)}
          onExport={exportReport}
          onOpenBuilder={() => setBuilderOpen(true)}
        />
      ) : (
        <ReportLibrary
          activeCategory={activeCategory}
          reports={currentReports}
          search={search}
          setSearch={setSearch}
          onExport={exportReport}
        />
      )}

      <ReportBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={(builder) => {
          const report: SavedReport = {
            id: crypto.randomUUID(),
            name: builder.name || "Custom Report",
            category: "Custom",
            cadence: "On demand",
            lastRun: "Not run",
            format: builder.format,
          };
          setSavedReports((current) => [report, ...current]);
          setBuilderOpen(false);
          showToast("Report template saved.");
        }}
        onGenerate={(builder) => {
          setBuilderOpen(false);
          exportReport(builder.format, builder.name);
        }}
      />

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[120] flex items-center gap-2 rounded-xl border border-cyan-300/[0.16] bg-[#06131d]/96 px-4 py-3 text-[10px] font-semibold text-cyan-100 shadow-[0_18px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <Check className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      ) : null}
    </WorkspaceFrame>
  );
}

function OverviewDashboard({
  period,
  setPeriod,
  savedReports,
  onRun,
  onExport,
  onOpenBuilder,
}: {
  period: string;
  setPeriod: (value: string) => void;
  savedReports: SavedReport[];
  onRun: (report: SavedReport) => void;
  onExport: (format: ExportFormat, name?: string) => void;
  onOpenBuilder: () => void;
}) {
  return (
    <>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
        <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Revenue and profit
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">Business performance</h2>
              <p className="mt-1 text-[10px] text-slate-600">
                Gross revenue and net profit across the selected period.
              </p>
            </div>

            <label className="relative">
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="h-10 appearance-none rounded-xl border border-white/[0.07] bg-[#07141e] pl-3 pr-9 text-[9px] font-semibold text-slate-400"
              >
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option>Year to date</option>
                <option>Last year</option>
                <option>All time</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700" />
            </label>
          </div>

          <RevenueChart />
        </section>

        <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-300/[0.12] bg-violet-400/[0.05] text-violet-300">
              <BrainCircuit className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">AI Insights</p>
              <p className="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-slate-700">
                Decision support
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <InsightCard
              title="Revenue increased 14.8%"
              detail="Growth was led by Commander staples and Modern Horizons 3 singles."
              type="positive"
            />
            <InsightCard
              title="Shipping costs are up 18%"
              detail="Average package weight and bubble-mailer usage are both trending higher."
              type="warning"
            />
            <InsightCard
              title="$12,400 in aging inventory"
              detail="These items have not sold in more than 365 days. Consider repricing or bundling."
              type="neutral"
            />
            <InsightCard
              title="Reserved List gained $3,216"
              detail="The strongest appreciation came from dual lands and older artifact staples."
              type="positive"
            />
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Marketplace performance
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">Channel profitability</h2>
            </div>

            <button
              type="button"
              onClick={() => onExport("Excel", "Marketplace Performance")}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-semibold text-slate-400"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[8px] uppercase tracking-[0.14em] text-slate-700">
                  <th className="px-3 py-3">Marketplace</th>
                  <th className="px-3 py-3">Gross sales</th>
                  <th className="px-3 py-3">Fees</th>
                  <th className="px-3 py-3">Shipping</th>
                  <th className="px-3 py-3">Net revenue</th>
                  <th className="px-3 py-3">Orders</th>
                </tr>
              </thead>
              <tbody>
                {MARKETPLACE_ROWS.map((row) => (
                  <tr key={row.channel} className="border-b border-white/[0.045] text-[10px] text-slate-500">
                    <td className="px-3 py-4 font-semibold text-slate-200">{row.channel}</td>
                    <td className="px-3 py-4">{currency(row.gross)}</td>
                    <td className="px-3 py-4 text-rose-300/75">-{currency(row.fees)}</td>
                    <td className="px-3 py-4 text-amber-300/75">-{currency(row.shipping)}</td>
                    <td className="px-3 py-4 font-semibold text-emerald-300">{currency(row.net)}</td>
                    <td className="px-3 py-4">{row.orders.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.glassPanel} rounded-[26px] p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Saved reports
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">One-click reporting</h2>
            </div>

            <button
              type="button"
              onClick={onOpenBuilder}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/[0.14] bg-cyan-400/[0.05] text-cyan-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-2.5">
            {savedReports.slice(0, 5).map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => onRun(report)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.055] bg-black/[0.08] px-3.5 py-3 text-left transition hover:border-cyan-300/[0.12]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.04] text-cyan-300">
                  {report.format === "PDF" ? (
                    <FileText className="h-4 w-4" />
                  ) : report.format === "JSON" ? (
                    <FileJson className="h-4 w-4" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-semibold text-slate-300">
                    {report.name}
                  </span>
                  <span className="mt-1 block text-[8px] text-slate-600">
                    {report.cadence} · {report.format}
                  </span>
                </span>

                <Download className="h-3.5 w-3.5 text-slate-700" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Export center
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Download your business data</h2>
            <p className="mt-1 text-[10px] text-slate-600">
              Export the current executive report in the format your accountant, insurer, or team needs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["PDF", "Excel", "CSV", "JSON"] as ExportFormat[]).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => onExport(format)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-semibold text-slate-400 transition hover:border-cyan-300/[0.14] hover:text-cyan-200"
              >
                {format === "PDF" ? (
                  <FileText className="h-3.5 w-3.5" />
                ) : format === "JSON" ? (
                  <FileJson className="h-3.5 w-3.5" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                {format}
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function ReportLibrary({
  activeCategory,
  reports,
  search,
  setSearch,
  onExport,
}: {
  activeCategory: Exclude<ReportCategory, "overview">;
  reports: Array<{
    title: string;
    description: string;
    icon: typeof FileBarChart2;
    badge?: string;
  }>;
  search: string;
  setSearch: (value: string) => void;
  onExport: (format: ExportFormat, name?: string) => void;
}) {
  const category = CATEGORY_TABS.find((item) => item.id === activeCategory);
  const CategoryIcon = category?.icon ?? FileBarChart2;

  return (
    <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.05] text-cyan-300">
              <CategoryIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Report library
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">{category?.label}</h2>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-5 text-slate-600">
            Select a report to generate it, adjust filters, or export the underlying data.
          </p>
        </div>

        <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 lg:max-w-[330px]">
          <Search className="h-3.5 w-3.5 text-slate-700" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reports..."
            className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-300 outline-none placeholder:text-slate-700"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;

          return (
            <article
              key={report.title}
              className="group rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/[0.14] hover:bg-cyan-400/[0.018]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.04] text-cyan-300">
                  <Icon className="h-4.5 w-4.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-semibold text-slate-200">{report.title}</h3>
                    {report.badge ? (
                      <span className="rounded-full border border-violet-300/[0.1] bg-violet-400/[0.04] px-2 py-0.5 text-[6px] font-semibold uppercase tracking-[0.1em] text-violet-300">
                        {report.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[9px] leading-4 text-slate-600">{report.description}</p>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onExport("PDF", report.title)}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-300/[0.12] bg-cyan-400/[0.045] text-[8px] font-semibold text-cyan-200"
                >
                  <FileText className="h-3 w-3" />
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => onExport("Excel", report.title)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-600 hover:text-cyan-300"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!reports.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.015] px-4 py-12 text-center">
          <Search className="mx-auto h-5 w-5 text-slate-700" />
          <p className="mt-3 text-xs font-semibold text-slate-400">No reports found</p>
        </div>
      ) : null}
    </section>
  );
}

function RevenueChart() {
  const max = Math.max(...MONTHLY_REVENUE);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const points = MONTHLY_REVENUE.map((value, index) => {
    const x = 18 + (index / (MONTHLY_REVENUE.length - 1)) * 724;
    const y = 190 - (value / max) * 148;
    return { x, y, value, month: months[index] };
  });
  const line = smoothPath(points);
  const area = `${line} L ${points[points.length - 1].x} 196 L ${points[0].x} 196 Z`;

  return (
    <div className="relative mt-5 h-[250px] overflow-hidden rounded-2xl border border-white/[0.055] bg-[#02090f]">
      <svg viewBox="0 0 760 220" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="bi-revenue-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bi-revenue-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(103 232 249)" />
            <stop offset="100%" stopColor="rgb(56 189 248)" />
          </linearGradient>
        </defs>

        {[55, 100, 145].map((y) => (
          <line key={y} x1="18" x2="742" y1={y} y2={y} stroke="rgba(148,163,184,0.07)" strokeDasharray="4 8" />
        ))}

        <path d={area} fill="url(#bi-revenue-area)" />
        <path d={line} fill="none" stroke="rgba(34,211,238,0.18)" strokeWidth="10" strokeLinecap="round" />
        <path d={line} fill="none" stroke="url(#bi-revenue-line)" strokeWidth="3" strokeLinecap="round" />

        {points.map((point, index) => (
          <text
            key={point.month}
            x={point.x}
            y="212"
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
            fill="rgb(100 116 139)"
            fontSize="9"
            fontWeight="600"
          >
            {point.month}
          </text>
        ))}
      </svg>

      <div className="absolute left-4 top-4">
        <p className="text-2xl font-semibold tracking-[-0.04em] text-white">$482,114</p>
        <p className="mt-1 text-[9px] font-semibold text-emerald-300">+$62,418 · 14.8%</p>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  detail,
  type,
}: {
  title: string;
  detail: string;
  type: "positive" | "warning" | "neutral";
}) {
  const dot =
    type === "positive"
      ? "bg-emerald-300"
      : type === "warning"
        ? "bg-amber-300"
        : "bg-cyan-300";

  return (
    <div className="rounded-xl border border-white/[0.055] bg-black/[0.08] px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <div>
          <p className="text-[10px] font-semibold text-slate-300">{title}</p>
          <p className="mt-1.5 text-[8px] leading-4 text-slate-600">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function ReportBuilder({
  open,
  onClose,
  onSave,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (builder: BuilderState) => void;
  onGenerate: (builder: BuilderState) => void;
}) {
  const [builder, setBuilder] = useState<BuilderState>(DEFAULT_BUILDER);

  if (!open) return null;

  function toggleList(field: "marketplaces" | "metrics", value: string) {
    setBuilder((current) => {
      const values = current[field];
      return {
        ...current,
        [field]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/72 p-4 backdrop-blur-md">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Close report builder" />

      <div className="relative z-10 max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[28px] border border-cyan-300/[0.14] bg-[#06131d]/98 p-5 shadow-[0_38px_120px_rgba(0,0,0,0.55)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/[0.12] bg-violet-400/[0.04] px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Visual report builder
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white">
              Create a reusable report
            </h2>
            <p className="mt-2 text-[10px] leading-5 text-slate-600">
              Choose the period, marketplaces, measurements, and export format.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4">
            <BuilderLabel icon={FileText} label="Report details" />

            <label className="mt-4 block">
              <span className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                Report name
              </span>
              <input
                value={builder.name}
                onChange={(event) => setBuilder((current) => ({ ...current, name: event.target.value }))}
                className="report-builder-input"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                Date range
              </span>
              <select
                value={builder.dateRange}
                onChange={(event) => setBuilder((current) => ({ ...current, dateRange: event.target.value }))}
                className="report-builder-input"
              >
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
                <option>Year to date</option>
                <option>Previous year</option>
                <option>Custom range</option>
              </select>
            </label>

            <div className="mt-4">
              <span className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                Output format
              </span>
              <div className="grid grid-cols-4 gap-2">
                {(["PDF", "Excel", "CSV", "JSON"] as ExportFormat[]).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setBuilder((current) => ({ ...current, format }))}
                    className={[
                      "h-9 rounded-lg border text-[8px] font-semibold",
                      builder.format === format
                        ? "border-cyan-300/[0.17] bg-cyan-400/[0.07] text-cyan-200"
                        : "border-white/[0.06] bg-white/[0.02] text-slate-600",
                    ].join(" ")}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4">
            <BuilderLabel icon={Store} label="Marketplaces" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["TCGplayer", "eBay", "Shopify", "Mana Pool", "Whatnot", "Direct"].map((marketplace) => (
                <ToggleOption
                  key={marketplace}
                  label={marketplace}
                  checked={builder.marketplaces.includes(marketplace)}
                  onClick={() => toggleList("marketplaces", marketplace)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4 lg:col-span-2">
            <BuilderLabel icon={Filter} label="Include in report" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Revenue",
                "Fees",
                "Shipping",
                "Taxes",
                "Net Profit",
                "COGS",
                "Expenses",
                "Refunds",
                "Inventory Value",
                "Order Count",
                "Average Order",
                "Profit Margin",
              ].map((metric) => (
                <ToggleOption
                  key={metric}
                  label={metric}
                  checked={builder.metrics.includes(metric)}
                  onClick={() => toggleList("metrics", metric)}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onSave(builder)}
            className="h-11 rounded-xl border border-white/[0.075] bg-white/[0.025] px-5 text-[10px] font-semibold text-slate-400"
          >
            Save template
          </button>
          <button
            type="button"
            onClick={() => onGenerate(builder)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 px-5 text-[10px] font-semibold text-[#001018]"
          >
            <Download className="h-4 w-4" />
            Generate report
          </button>
        </div>

        <style jsx global>{`
          .report-builder-input {
            height: 42px;
            width: 100%;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.075);
            background: rgba(255, 255, 255, 0.025);
            padding: 0 12px;
            color: rgb(226 232 240);
            font-size: 11px;
            outline: none;
          }
          .report-builder-input:focus {
            border-color: rgba(103, 232, 249, 0.24);
            box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.045);
          }
        `}</style>
      </div>
    </div>
  );
}

function BuilderLabel({
  icon: Icon,
  label,
}: {
  icon: typeof FileBarChart2;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-cyan-300" />
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function ToggleOption({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-10 items-center gap-2 rounded-xl border px-3 text-left text-[9px] font-semibold transition",
        checked
          ? "border-cyan-300/[0.14] bg-cyan-400/[0.055] text-cyan-100"
          : "border-white/[0.055] bg-white/[0.018] text-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-4 w-4 items-center justify-center rounded border",
          checked
            ? "border-cyan-300/30 bg-cyan-400/[0.1] text-cyan-200"
            : "border-white/[0.08]",
        ].join(" ")}
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      {label}
    </button>
  );
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
