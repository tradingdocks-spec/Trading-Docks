export const CHAOS_SORT_MAX_BATCH_SIZE = 100;
export const CHAOS_SORT_RECOGNITION_CONCURRENCY = 4;
export const CHAOS_SORT_MAX_RECOGNITION_ATTEMPTS = 3;
export const CHAOS_SORT_MAX_RETRY_DELAY_MS = 30_000;

export type ChaosSortQueueState = "queued" | "processing" | "identified" | "needs_review" | "unknown" | "failed";

export type ChaosSortQueueItem<T> = {
  id: string;
  input: T;
  state: ChaosSortQueueState;
};

export function claimChaosSortQueueItem<T>(item: ChaosSortQueueItem<T>) {
  if (item.state !== "queued") return false;
  item.state = "processing";
  return true;
}

export function parseRetryAfterMs(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(CHAOS_SORT_MAX_RETRY_DELAY_MS, seconds * 1000));
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, Math.min(CHAOS_SORT_MAX_RETRY_DELAY_MS, timestamp - now)) : null;
}

export function chaosSortRetryDelayMs(attempt: number, retryAfterMs: number | null = null) {
  if (retryAfterMs !== null) return Math.min(CHAOS_SORT_MAX_RETRY_DELAY_MS, Math.max(0, retryAfterMs));
  return Math.min(CHAOS_SORT_MAX_RETRY_DELAY_MS, 500 * 2 ** Math.max(0, attempt - 1));
}

export function buildChaosSortQueue<T>(inputs: T[], idForInput: (input: T, index: number) => string) {
  return inputs.slice(0, CHAOS_SORT_MAX_BATCH_SIZE).map((input, index) => ({
    id: idForInput(input, index),
    input,
    state: "queued" as const,
  }));
}

export async function runBoundedChaosSortQueue<T>(
  queue: ChaosSortQueueItem<T>[],
  worker: (item: ChaosSortQueueItem<T>) => Promise<void>,
  concurrency = CHAOS_SORT_RECOGNITION_CONCURRENCY,
) {
  const limit = Math.max(1, Math.min(8, Math.floor(concurrency)));
  let nextIndex = 0;
  async function consume() {
    while (nextIndex < queue.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = queue[index];
      if (claimChaosSortQueueItem(item)) await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, () => consume()));
  return queue;
}
