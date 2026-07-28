"use client";

import { useEffect, useState, type ReactNode } from "react";

const RESET_VERSION = "2026-07-27-remove-example-cards-v4";

export function LegacyAccountDataCleanup({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const markerKey = `trading-docks-account-data-reset:${RESET_VERSION}:${userId}`;

    if (window.localStorage.getItem(markerKey) !== "complete") {
      const inventoryKeys = [
        "trading-docks-inventory-items-v1",
        `trading-docks-inventory-items-v1:${userId}`,
        "trading-docks-inventory",
        `trading-docks-inventory:${userId}`,
      ];
      const exampleNames = new Set(["painsmith", "crop rotation"]);
      for (const key of inventoryKeys) {
        const stored = window.localStorage.getItem(key);
        if (!stored) continue;
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (!Array.isArray(parsed)) continue;
          const cleaned = parsed.filter((item) => {
            if (!item || typeof item !== "object") return true;
            const record = item as Record<string, unknown>;
            const name = String(record.name ?? record.cardName ?? record.productName ?? "").trim().toLowerCase();
            return !exampleNames.has(name);
          });
          window.localStorage.setItem(key, JSON.stringify(cleaned));
        } catch {
          // Leave unrelated user data untouched if a legacy value is not valid JSON.
        }
      }

      window.localStorage.setItem(markerKey, "complete");
    }

    setReady(true);
  }, [userId]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020b12] text-sm text-slate-500">
        Preparing your empty workspace…
      </main>
    );
  }

  return children;
}
