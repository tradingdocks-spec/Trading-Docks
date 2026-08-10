import { CsvConversionEngine } from "@/components/dashboard/tools/CsvConversionEngine";
import { requireServerCapability } from "@/lib/platform/server-access";

export default async function CsvConverterPage() {
  await requireServerCapability("csv.export", "/dashboard/plans");
  return <CsvConversionEngine />;
}
