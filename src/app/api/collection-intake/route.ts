import { NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";
import {
  completeCollectionIntake,
  loadCollectionIntakes,
  saveCollectionIntake,
  type CompleteCollectionIntakeInput,
  type SaveCollectionIntakeInput,
} from "@/lib/collection-intake/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function errorResponse(error: { code?: string; message?: string; details?: string; hint?: string } | null, fallback: string) {
  const missingSchema =
    error?.code === "42P01" ||
    error?.code === "PGRST205" || error?.code === "PGRST202";
  return NextResponse.json({
    error: missingSchema ? "Collection Intake schema is not configured for this environment." : fallback,
    message: error?.message ?? fallback,
    code: error?.code,

  }, { status: missingSchema ? 503 : error?.code === "42501" ? 403 : error?.code === "40001" ? 409 : error?.code === "22023" ? 400 : 500 });
}

export async function GET() {
  const capability = await requireApiCapability("buying.manage");
  if (!capability.ok) return capability.response;

  const result = await loadCollectionIntakes({
    supabase: capability.supabase,
    userId: capability.user?.id ?? "",
    workspaceId: capability.access.workspaceId,
  });

  return NextResponse.json(result, { status: result.schemaAvailable ? 200 : 503 });
}

export async function POST(request: Request) {
  const capability = await requireApiCapability("buying.manage");
  if (!capability.ok) return capability.response;

  const body = await request.json().catch(() => null);
  const payload = objectRecord(body);
  const action = stringValue(payload.action);

  if (action === "save") {
    const input = objectRecord(payload.intake) as SaveCollectionIntakeInput;
    const result = await saveCollectionIntake({
      supabase: capability.supabase,
      userId: capability.user?.id ?? "",
      workspaceId: capability.access.workspaceId,
      input,
    });
    if (result.error) return errorResponse(result.error, "Collection intake could not be saved.");
    return NextResponse.json({ ok: true, ...result.data }, { status: 200 });
  }

  if (action === "complete") {
    const input = objectRecord(payload.completion) as CompleteCollectionIntakeInput;
    if (!input.intakeId) {
      return NextResponse.json({ error: "Choose a saved collection intake before completing a purchase." }, { status: 400 });
    }
    const result = await completeCollectionIntake({
      supabase: capability.supabase,
      input: {
        intakeId: input.intakeId,
        actualOffer: input.actualOffer,
        receiveNow: input.receiveNow,
        locationId: input.locationId,
        idempotencyKey: input.idempotencyKey ?? `collection-intake:${input.intakeId}`,
      },
    });
    if (result.error) return errorResponse(result.error, "Collection intake could not be completed.");
    return NextResponse.json({ ok: true, result: result.data }, { status: 200 });
  }

  return NextResponse.json({ error: "Unsupported Collection Intake action." }, { status: 400 });
}
