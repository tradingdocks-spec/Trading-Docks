import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";
/** Old IDs-only requests cannot prove the original selected quantity after response loss. */
export async function POST() {
  const capability = await requireApiCapability("collection.write");
  if (!capability.ok) return capability.response;
  return NextResponse.json({ error: "Reload Collection and use the durable removal workflow. No removal was sent.",
    code: "OPERATION_ID_REQUIRED" }, { status: 409 });
}
