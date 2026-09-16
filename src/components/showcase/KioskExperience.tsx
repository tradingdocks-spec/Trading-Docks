"use client";

import { useEffect, useState } from "react";
import { ShowcasePublicExperience } from "@/components/showcase/ShowcasePublicExperience";
import type { ShowcaseCard, ShowcaseProfile } from "@/lib/showcase";

export function KioskExperience() {
  const [state, setState] = useState<{ profile: ShowcaseProfile; cards: ShowcaseCard[]; slug: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch(`/api/showcase/kiosk${window.location.search}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) { if (active) setInvalid(true); return; }
      const data = await response.json();
      if (active) setState({ profile: data.profile, cards: data.cards, slug: data.kiosk.showcase_slug });
    });
    return () => { active = false; };
  }, [resetKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => setResetKey((value) => value + 1), 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [resetKey]);

  if (invalid) return <div className="flex min-h-screen items-center justify-center bg-td-canvas p-6 text-center text-td-primary"><div><h1 className="text-2xl font-semibold">This kiosk session has ended.</h1><button onClick={() => { setInvalid(false); setState(null); setResetKey((value) => value + 1); }} className="td-button-primary mt-5 px-5 py-3">Pair again</button></div></div>;
  if (!state) return <div className="flex min-h-screen items-center justify-center bg-td-canvas text-td-accent-text">Loading Showcase…</div>;
  return <ShowcasePublicExperience key={resetKey} slug={state.slug} profile={state.profile} cards={state.cards} initialQuery={new URLSearchParams(window.location.search).get("q") ?? ""} kioskMode onStartOver={() => { window.history.replaceState(null, "", "/kiosk"); setResetKey((value) => value + 1); }} />;
}
