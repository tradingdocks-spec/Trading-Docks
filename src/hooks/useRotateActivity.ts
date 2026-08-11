"use client";

import { useEffect, useMemo, useState } from "react";

import { HERO_DEMO_WORKSPACE } from "@/components/landing/landing-data";

export function useRotateActivity() {
  const activities = useMemo(
    () => [
      ...HERO_DEMO_WORKSPACE.activity,
      ...HERO_DEMO_WORKSPACE.syncedActivity,
    ],
    [],
  );

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setOffset((current) => (current + 1) % activities.length);
    }, 3600);

    return () => window.clearInterval(interval);
  }, [activities.length]);

  return [
    activities[offset],
    activities[(offset + 1) % activities.length],
    activities[(offset + 2) % activities.length],
    activities[(offset + 3) % activities.length],
  ];
}
