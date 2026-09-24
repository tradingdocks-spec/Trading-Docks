import { createHash } from "node:crypto";
import sharp from "sharp";
import { requireApiCapability } from "@/lib/platform/server-access";
import { issueCapturePermit } from "@/lib/chaos-sort/capture-permit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
async function access() {
  const result = await requireApiCapability("collection.write");
  if (!result.ok) return result;
  return result;
}
export async function GET(request: Request) {
  const auth = await access(); if (!auth.ok) return auth.response;
  const url = new URL(request.url), captureId = url.searchParams.get("captureId"), batchId = url.searchParams.get("batchId");
  if (captureId) {
    const { data, error } = await auth.supabase.from("chaos_scan_captures").select("object_path,status").eq("capture_id", captureId).maybeSingle();
    if (error || !data || !data.object_path || data.status === "EXPIRED") return new Response("Scan unavailable", { status: 404, headers });
    const image = await auth.supabase.storage.from("chaos-scans").download(data.object_path);
    if (image.error || !image.data) return new Response("Scan unavailable", { status: 404, headers });
    return new Response(image.data, { headers: { ...headers, "Content-Type": "image/jpeg" } });
  }
  const result = url.searchParams.has("history")
    ? await auth.supabase.rpc("chaos_batch_history", { p_before: url.searchParams.get("before"), p_id: url.searchParams.get("id"), p_limit: 25 })
    : await auth.supabase.rpc("chaos_scan_command", { action: batchId ? "snapshot" : "current", payload: batchId ? { batchId } : {} });
  if (result.error) return Response.json({ error: "Cloud batch unavailable. Retry before continuing." }, { status: 409, headers });
  return Response.json(result.data, { headers });
}
export async function POST(request: Request) {
  const auth = await access(); if (!auth.ok) return auth.response;
  try {
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if (Number(request.headers.get("content-length")) > 4_000_000) throw new Error("Scan image is too large.");
      const form = await request.formData(); const file = form.get("image");
      if (!(file instanceof File) || file.size > 3_500_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Invalid scan image.");
      const bytes = Buffer.from(await file.arrayBuffer());
      const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error" });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Invalid image encoding.");
      const normalized = await image.rotate().resize({ width: 2500, height: 2500, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      const payload = { batchId: String(form.get("batchId")), captureId: String(form.get("captureId")), sha256: createHash("sha256").update(normalized).digest("hex") };
      const reserved = await auth.supabase.rpc("chaos_scan_command", { action: "reserve", payload });
      if (reserved.error) throw new Error(reserved.error.message);
      if (reserved.data.status === "RESERVED") {
        const upload = await auth.supabase.storage.from("chaos-scans").upload(reserved.data.object_path, normalized, { contentType: "image/jpeg", upsert: false });
        if (upload.error) {
          // Recover a response lost after Storage accepted the same immutable object.
          const existing = await auth.supabase.storage.from("chaos-scans").download(reserved.data.object_path);
          if (existing.error || !existing.data || createHash("sha256").update(Buffer.from(await existing.data.arrayBuffer())).digest("hex") !== payload.sha256) throw new Error("Private scan upload failed; local capture retained.");
        }
      }
      const completed = await auth.supabase.rpc("chaos_scan_command", { action: "received", payload });
      if (completed.error) throw new Error(completed.error.message);
      return Response.json({ captureId: payload.captureId, sourceImageUrl: `/api/chaos-sort/scans?captureId=${payload.captureId}` }, { headers });
    }
    const body = await request.json();
    if (body.action === "authorize-capture") {
      if (!auth.user) return Response.json({ error: "Sign in before scanning." }, { status: 401, headers });
      const snapshot = await auth.supabase.rpc("chaos_scan_command", { action: "snapshot", payload: { batchId: body.payload?.batchId } });
      const album = snapshot.data?.album;
      if (snapshot.error || !album || (body.payload?.purpose !== "ack" && album.state !== "ACTIVE") || album.intake_mode !== "live" || album.device_id !== body.payload?.deviceId || album.workstation_id !== body.payload?.workstationId || !/^[0-9a-f-]{36}$/i.test(body.payload?.captureId ?? "")) throw new Error("Capture not authorized for this batch.");
      const purpose = body.payload?.purpose === "preview" ? "preview" : body.payload?.purpose === "ack" ? "ack" : "capture";
      if (purpose === "preview" && !/^[0-9a-f-]{36}$/i.test(body.payload.previewSessionId ?? "")) throw new Error("Invalid preview session.");
      if (purpose === "ack" && !snapshot.data.captures?.some((capture: { capture_id: string; status: string }) => capture.capture_id === body.payload.captureId && capture.status === "RECEIVED")) throw new Error("Cloud has not accepted this capture.");
      const key = process.env.SCANNER_CAPTURE_SIGNING_KEY;
      if (!key) throw new Error("Scanner Agent authorization is not configured. Your batch is unchanged.");
      return Response.json({ authorization: issueCapturePermit({ userId: auth.user.id, workspaceId: album.workspace_id, batchId: album.id, sessionId: purpose === "preview" ? body.payload.previewSessionId : album.id, workstationId: album.workstation_id, deviceId: album.device_id, destinationId: album.destination_id, captureId: body.payload.captureId, purpose }, key) }, { headers });
    }
    if (!["create", "mode", "settings", "start", "csv", "review", "commit", "label"].includes(body.action)) throw new Error("Invalid scan action.");
    const result = await auth.supabase.rpc("chaos_scan_command", body);
    if (result.error) throw new Error(result.error.message);
    return Response.json(result.data, { headers });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Scan request failed" }, { status: 409, headers }); }
}
