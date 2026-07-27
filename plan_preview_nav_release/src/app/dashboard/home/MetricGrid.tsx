"use client";

import {
  CircleDollarSign,
  PackageCheck,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import { MetricCard } from "./MetricCard";

export function MetricGrid() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Inventory Value"
        value="$482,114"
        subtitle="Across 18,642 items"
        icon={WalletCards}
        trend={8.4}
        glow="cyan"
      />

      <MetricCard
        title="Monthly Revenue"
        value="$18,421"
        subtitle="Gross sales this month"
        icon={CircleDollarSign}
        trend={12.7}
        glow="emerald"
      />

      <MetricCard
        title="Orders Today"
        value="38"
        subtitle="12 awaiting shipment"
        icon={ShoppingCart}
        trend={5.2}
        glow="purple"
      />

      <MetricCard
        title="Active Listings"
        value="7,284"
        subtitle="Across 4 marketplaces"
        icon={PackageCheck}
        trend={-1.8}
        glow="orange"
      />
    </section>
  );
}