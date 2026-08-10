import { redirect } from "next/navigation";

import { TcgplayerCatalogManager } from "@/components/dashboard/admin/catalog/TcgplayerCatalogManager";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";

export const dynamic = "force-dynamic";

export default async function TcgplayerCatalogPage() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) redirect("/dashboard");

  return <TcgplayerCatalogManager />;
}
