"use client";

import { useEffect, useMemo, useState } from "react";

export function useRotateActivity() {
  const activities = useMemo(
    () => [
      ["Inventory imported", "+248"],
      ["Marketplace sale", "$45.72"],
      ["Price movement", "+6.4%"],
      ["Listing published", "Live"],
      ["Order fulfilled", "#10291"],
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
