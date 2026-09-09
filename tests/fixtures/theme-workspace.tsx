import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Boxes, PackageCheck, TrendingUp, Wallet, X } from "lucide-react";
import { MetricCard } from "../../src/components/dashboard/common/MetricCard";
import { PageHeader } from "../../src/components/dashboard/common/PageHeader";
import {
  ThemeProvider,
  ThemePicker,
} from "../../src/components/theme/ThemeProvider";

function Workspace() {
  const [open, setOpen] = useState(false);
  return (
    <ThemeProvider>
      <main className="td-workspace" style={{ maxWidth: 1200 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <p className="text-sm text-td-muted">
            Isolated component review · Example data
          </p>
          <ThemePicker />
        </div>
        <PageHeader
          eyebrow="Inventory operations"
          title="A clear view of your cards."
          description="Shared dashboard components rendered from the application source for theme and contrast review."
          icon={Boxes}
          actionLabel="Review sample item"
          onAction={() => setOpen(true)}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
            margin: "24px 0",
          }}
        >
          <MetricCard
            label="Inventory value"
            value="$8,240"
            detail="Illustrative collection"
            icon={Wallet}
          />
          <MetricCard
            label="Cards in storage"
            value="426"
            detail="18 locations"
            icon={Boxes}
          />
          <MetricCard
            label="Ready to pick"
            value="12"
            detail="Example orders"
            icon={PackageCheck}
          />
          <MetricCard
            label="Monthly change"
            value="+4.2%"
            detail="Example movement"
            icon={TrendingUp}
          />
        </div>
        <section className="td-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-td-primary">
              Inventory review
            </h2>
            <input
              aria-label="Search sample inventory"
              className="portfolio-input"
              style={{ maxWidth: 260 }}
              placeholder="Find a card or location"
            />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-td-muted">
                <tr>
                  <th className="p-3">Card</th>
                  <th>Location</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Lightning Greaves",
                    "Box 04 / B / 018",
                    "$28.00",
                    "Ready",
                    "success",
                  ],
                  ["Sol Ring", "Binder 02 / 03", "$3.00", "Review", "warning"],
                  [
                    "Arcane Signet",
                    "Unassigned",
                    "$2.00",
                    "Location needed",
                    "danger",
                  ],
                ].map(([name, location, value, status, tone]) => (
                  <tr className="border-t border-td-ink/10" key={name}>
                    <td className="p-3 text-td-primary">{name}</td>
                    <td className="text-td-secondary">{location}</td>
                    <td className="text-td-primary">{value}</td>
                    <td>
                      <span style={{ color: `var(--td-${tone})` }}>
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="td-button-primary px-4"
              onClick={() => setOpen(true)}
            >
              Review sample item
            </button>
            <button className="td-button-secondary px-4">Export preview</button>
            <button className="td-button-secondary px-4" disabled>
              Unavailable
            </button>
          </div>
        </section>
        {open ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sample item review"
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--td-scrim)",
              display: "grid",
              placeItems: "center",
              padding: 24,
            }}
          >
            <section
              className="td-panel-strong p-6"
              style={{
                width: "min(100%,420px)",
                boxShadow: "var(--td-elevation-overlay)",
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl text-td-primary">Review sample item</h2>
                <button
                  aria-label="Close sample review"
                  className="text-td-secondary"
                  onClick={() => setOpen(false)}
                >
                  <X />
                </button>
              </div>
              <label className="mt-5 block text-sm text-td-secondary">
                Storage location
                <input
                  className="portfolio-input mt-2"
                  defaultValue="Box 04 / B / 018"
                />
              </label>
              <p className="mt-4 text-sm text-td-muted">
                This isolated preview makes no account changes.
              </p>
              <button
                className="td-button-primary mt-5 px-4"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </section>
          </div>
        ) : null}
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("theme-fixture")!).render(<Workspace />);
