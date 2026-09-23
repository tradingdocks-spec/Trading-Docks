import type { ChaosSortItem } from "./domain.ts";
import { CHAOS_SORT_MAX_BATCH_SIZE, CHAOS_SORT_RECOGNITION_CONCURRENCY } from "./batch-queue.ts";

export type LiveScanStatus = "CAPTURING" | "PROCESSING" | "CONFIRMED" | "NEEDS REVIEW" | "UNKNOWN" | "FAILED";
export function physicalCardCount(items: Pick<ChaosSortItem, "humanState" | "quantity">[]) {
  return items.filter(item => item.humanState !== "removed").reduce((sum, item) => sum + item.quantity, 0);
}
export function liveScanStatus(item: ChaosSortItem): LiveScanStatus {
  if (item.processingState === "failed") return "FAILED";
  if (item.processingState !== "ready") return "PROCESSING";
  if (item.humanState === "confirmed" && item.recognitionState !== "unknown" && item.cardName && item.setCode && item.collectorNumber) return "CONFIRMED";
  if (item.recognitionState === "unknown") return "UNKNOWN";
  return "NEEDS REVIEW";
}
export function unresolvedLiveItems(items: ChaosSortItem[]) {
  return items.filter(item => item.humanState !== "removed" && liveScanStatus(item) !== "CONFIRMED");
}
export function assertIntakeRoom(current: number, incoming: number) {
  if (!Number.isSafeInteger(incoming) || incoming < 1 || current + incoming > CHAOS_SORT_MAX_BATCH_SIZE) {
    throw new Error("Batch capacity is 100 physical cards. Commit or remove cards before adding more.");
  }
}

/** Additional HTTP guard for the live path; DB remains the inventory authority. */
export function validateLiveCommit(items: Array<Partial<ChaosSortItem>>) {
  if (!items.length || items.some(item => !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1) || items.reduce((sum, item) => sum + Number(item.quantity), 0) > 100) return "Live batches require 1–100 physical cards.";
  if (items.some(item => item.humanState !== "confirmed" || item.recognitionState === "unknown" || item.processingState !== "ready" || !item.cardName?.trim() || !item.setCode || !item.collectorNumber)) return "Resolve every card before committing the batch.";
  return null;
}

/** Shared across all calls to the existing image intake, not one pool per capture. */
export class RecognitionPool {
  private active = 0;
  private waiting: Array<() => void> = [];
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= CHAOS_SORT_RECOGNITION_CONCURRENCY) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active += 1;
    try { return await work(); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active -= 1; }
  }
}
