export const CHAOS_SORT_MAX_BATCH_SIZE = 100;
export const CHAOS_SORT_RECOGNITION_CONCURRENCY = 4;

export type ChaosSortQueueState = "queued" | "processing" | "identified" | "needs_review" | "unknown" | "failed";

export type ChaosSortQueueItem<T> = {
  id: string;
  input: T;
  state: ChaosSortQueueState;
};

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
      await worker(queue[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, () => consume()));
  return queue;
}
