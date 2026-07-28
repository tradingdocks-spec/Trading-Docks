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
        value="$0"
        subtitle="No inventory added yet"
        icon={WalletCards}
        trend={0}
        glow="cyan"
      />

      <MetricCard
        title="Monthly Revenue"
        value="$0"
        subtitle="No sales recorded yet"
        icon={CircleDollarSign}
        trend={0}
        glow="emerald"
      />

      <MetricCard
        title="Orders Today"
        value="0"
        subtitle="No orders yet"
        icon={ShoppingCart}
        trend={0}
        glow="purple"
      />

      <MetricCard
        title="Active Listings"
        value="0"
        subtitle="No active listings"
        icon={PackageCheck}
        trend={0}
        glow="orange"
      />
    </section>
  );
}
