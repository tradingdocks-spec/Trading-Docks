"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";

export function RevenueCatBillingManagementButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/billing/revenuecat/portal", { method: "POST" });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "RevenueCat subscription management could not open.");
      }
      window.location.assign(result.url);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "RevenueCat subscription management could not open.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-td-accent px-5 text-sm font-semibold text-td-on-accent transition hover:brightness-110 disabled:opacity-70"
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {loading ? "Opening..." : "Manage subscription"}
      </button>
      {error ? <p className="mt-2 text-xs text-td-danger">{error}</p> : null}
    </div>
  );
}
