"use client";

import { useEffect, useState, type ReactNode } from "react";

const RESET_VERSION = "2026-07-27-account-isolation-v4";

const EXACT_DATA_KEYS = [
  "trading-docks-inventory-locations-v1",
  "trading-docks-inventory-items-v1",
  "trading-docks-inventory-movements-v1",
  "trading-docks-inventory",
  "trading-docks-imported-decks",
  "trading-docks-last-saved-deck",
  "trading-docks-business-calendar-v3",
];

const DECK_KEY_PREFIXES = [
  "trading-docks-deck:",
  "trading-docks-unresolved:",
];

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
      // Remove only obsolete shared keys. Never erase valid data belonging to
      // the signed-in account.
      for (const key of EXACT_DATA_KEYS) {
        window.localStorage.removeItem(key);
      }

      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;

        const isLegacySharedDeck = DECK_KEY_PREFIXES.some((prefix) => {
          if (!key.startsWith(prefix)) return false;
          const identifier = key.slice(prefix.length);
          return identifier.length > 0 && !identifier.includes(":");
        });

        if (isLegacySharedDeck) {
          window.localStorage.removeItem(key);
        }
      }

      window.localStorage.setItem(markerKey, "complete");
    }

    setReady(true);
  }, [userId]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-td-canvas text-sm text-td-muted">
        Preparing your empty workspace…
      </main>
    );
  }

  return children;
}
