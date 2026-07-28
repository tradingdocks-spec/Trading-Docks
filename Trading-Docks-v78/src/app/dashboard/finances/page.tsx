import { CircleDollarSign } from "lucide-react";

import { PageScaffold } from "@/components/dashboard/common/PageScaffold";

export default function FinancesPage() {
  return (
    <PageScaffold
      eyebrow="Finances"
      title="Financial command center"
      description="Track revenue, expenses, payouts, fees, profit, and cash flow."
      icon={CircleDollarSign}
      stats={[
        { label: "Monthly revenue", value: "$0", detail: "No sales recorded" },
        { label: "Net profit", value: "$0", detail: "No financial activity" },
        { label: "Pending payouts", value: "$0", detail: "No payouts pending" },
        { label: "Expenses", value: "$0", detail: "No expenses recorded" }
      ]}
    />
  );
}
