import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepareInventoryImport } from "@/lib/csv-conversion/inventory-import";
import { executeInventoryCommit, InventoryCommitError } from "@/lib/inventory-commit";

export async function POST(request: Request) {
  const capability = await requireApiCapability("collection.write");
  if (!capability.ok) return capability.response;
  let prepared: ReturnType<typeof prepareInventoryImport>;
  try {
    prepared = prepareInventoryImport(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid import." }, { status: 400 });
  }
  try {
    const result = await executeInventoryCommit(createAdminClient(), "commit_csv_inventory_import", {
      actor_id: capability.user!.id, import_key: prepared.importKey, payload: prepared.payload,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import could not be confirmed. Retry the same CSV and destination." },
      { status: error instanceof InventoryCommitError ? error.status : 500 });
  }
}
