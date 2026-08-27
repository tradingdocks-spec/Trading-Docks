import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";
import { validateInventoryPrinting } from "@/lib/card-intelligence";

export async function POST(request: Request) {
  const capability = await requireApiCapability("collection.write");
  if (!capability.ok) return capability.response;
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const printingId = typeof payload?.printingId === "string" ? payload.printingId.slice(0, 180) : "";
  const game = payload?.game === "pokemon" ? "pokemon" : payload?.game === "magic" ? "magic" : null;
  if (!printingId || !game) return NextResponse.json({ error: "Exact printing ID and game are required." }, { status: 400 });
  const validated = await validateInventoryPrinting({
    printingId,
    game,
    finish: typeof payload?.finish === "string" ? payload.finish.slice(0, 40) : null,
    providerIds: sanitizedProviderIds(payload?.providerIds),
  });
  return validated ? NextResponse.json({ valid: true, identity: validated.canonicalInventoryIdentity }) : NextResponse.json({ valid: false, error: "Printing identity could not be authoritatively validated." }, { status: 422 });
}

function sanitizedProviderIds(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 12).flatMap(([key, entry]) => {
    if (typeof entry !== "string" && typeof entry !== "number") return [];
    const provider = key.trim().toLowerCase().slice(0, 40);
    if (!provider) return [];
    return [[provider, typeof entry === "string" ? entry.slice(0, 180) : entry]];
  }));
}
