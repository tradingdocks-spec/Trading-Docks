"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Billing portal could not open.");
      window.location.assign(result.url);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Billing portal could not open.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-[#001018] transition hover:brightness-110 disabled:opacity-70"
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {loading ? "Opening…" : "Manage billing"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
