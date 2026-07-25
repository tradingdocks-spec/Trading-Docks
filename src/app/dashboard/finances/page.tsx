import { CircleDollarSign } from "lucide-react";

import { PageScaffold } from "@/components/dashboard/shared/PageScaffold";

export default function FinancesPage() {
  return (
    <PageScaffold
      eyebrow="Finances"
      title="Financial command center"
      description="Track revenue, expenses, payouts, fees, profit, and cash flow."
      icon={CircleDollarSign}
      stats={[
        { label: "Monthly revenue", value: "$18,421", detail: "+18.2% this month" },
    { label: "Net profit", value: "$6,842", detail: "After fees and costs" },
    { label: "Pending payouts", value: "$4,218", detail: "Across marketplaces" },
    { label: "Expenses", value: "$7,361", detail: "Inventory and operations" }
      ]}
    />
  );
}

