import { redirect } from "next/navigation";

import { CsvConversionEngine } from "@/components/dashboard/tools/CsvConversionEngine";
import { getEffectivePlan } from "@/lib/effective-plan";
import { hasPlanAccess } from "@/lib/tier-access";

export default async function CsvConverterPage() {
  const plan = await getEffectivePlan();
  if (!hasPlanAccess(plan, "csv-tools")) redirect("/dashboard/plans");
  return <CsvConversionEngine />;
}
