import type { ChaosSortItem } from "./domain";
export type ScanAlbum = { id: string; workspace_id: string; batch_code: string; destination_id: string; destination_label: string; workstation_id: string; device_id: string; state: string; intake_mode: "live" | "upload" | "csv"; settings: { title?: string; acquisitionCost?: number | null; rules?: import("./domain").ChaosSortRule[] }; settings_revision: number; label_confirmed_at: string | null };
// Optimistic concurrency tokens are cached, not authoritative review content.
const revisions = new Map<string, number>();
export function rememberScanRevisions(captures: Array<{ capture_id: string; revision: number }>) {
  for (const capture of captures) revisions.set(capture.capture_id, capture.revision);
}
export async function scanCommand<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/chaos-sort/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Scan album unavailable"); return result;
}
export async function storeScan(batchId: string, captureId: string, file: File): Promise<string> {
  if (file.size > 3_000_000) {
    const image = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d"); if (!context) throw new Error("Image normalization unavailable; local source retained.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image normalization failed")), "image/jpeg", 0.88));
      if (blob.size > 3_500_000) throw new Error("Scan too large; lower scanner resolution. Local source retained.");
      file = new File([blob], `${captureId}.jpg`, { type: "image/jpeg" });
    } finally { image.close(); }
  }
  const form = new FormData(); form.set("batchId", batchId); form.set("captureId", captureId); form.set("image", file);
  const response = await fetch("/api/chaos-sort/scans", { method: "POST", body: form });
  const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Scan upload failed; local capture retained."); return result.sourceImageUrl;
}
let reviewQueue: Promise<void> = Promise.resolve();
export function saveScanReview(batchId: string, items: ChaosSortItem[]) {
  const task = reviewQueue.catch(() => {}).then(async () => { for (const item of items) {
    if (!item.captureId) throw new Error("This scan album cannot include unrelated upload/CSV items.");
    const result = await scanCommand<{ revision: number }>("review", { batchId, captureId: item.captureId, revision: revisions.get(item.captureId) ?? 0, item: { ...item, sourceImageUrl: null } });
    revisions.set(item.captureId, result.revision);
  } });
  reviewQueue = task;
  return task;
}
export function recoveredScanItem(batchId: string, captureId: string, kind: "image" | "csv" = "image"): ChaosSortItem {
  return { id: captureId, captureId, batchId, intakeSource: kind === "csv" ? "csv" : "live", sourceFileName: `${captureId}.jpg`, sourceFileHash: "", sourceImageUrl: `/api/chaos-sort/scans?captureId=${captureId}`, processingState: "failed", recognitionState: "review", humanState: "pending", cardName: "", scryfallId: null, gameId: "magic", setCode: null, collectorNumber: null, rarity: null, finish: null, condition: null, quantity: 1, marketPrice: null, existingOwnedQuantity: 0, destinationLocationId: null, destinationLabel: "", sortPile: "review", sortPass: 1, confidence: 0, evidence: [], notes: "Private source scan recovered. Retry recognition or review manually before commit.", duplicateOfItemId: null, sortRuleId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
