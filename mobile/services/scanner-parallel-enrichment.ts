export type ScannerParallelEnrichmentTaskName = 'collector_refinement' | 'printing_disambiguation' | 'finish_inference' | 'thumbnail' | 'pricing';

export type ScannerParallelEnrichmentTask<TSession> = {
  name: ScannerParallelEnrichmentTaskName;
  run: (input: { session: TSession; lineId: string; stableScanId: string }) => TSession | Promise<TSession>;
};

export type ScannerParallelEnrichmentResult<TSession> = {
  session: TSession;
  completed: ScannerParallelEnrichmentTaskName[];
  failed: { name: ScannerParallelEnrichmentTaskName; reason: string }[];
};

export async function runScannerParallelEnrichment<TSession>(input: {
  session: TSession;
  lineId: string;
  stableScanId: string;
  tasks: ScannerParallelEnrichmentTask<TSession>[];
}): Promise<ScannerParallelEnrichmentResult<TSession>> {
  const completed: ScannerParallelEnrichmentTaskName[] = [];
  const failed: { name: ScannerParallelEnrichmentTaskName; reason: string }[] = [];
  const results = await Promise.all(input.tasks.map(async (task) => {
    try {
      return { ok: true as const, name: task.name, session: await task.run({ session: input.session, lineId: input.lineId, stableScanId: input.stableScanId }) };
    } catch (error) {
      return { ok: false as const, name: task.name, reason: error instanceof Error ? error.message : 'Unknown enrichment failure.' };
    }
  }));

  let nextSession = input.session;
  for (const result of results) {
    if (result.ok) {
      completed.push(result.name);
      nextSession = result.session;
    } else {
      failed.push({ name: result.name, reason: result.reason });
    }
  }
  return { session: nextSession, completed, failed };
}

export function createScannerParallelEnrichmentSchedule(input: {
  sessionInserted: boolean;
  lineId: string | null;
  stableScanId: string | null;
  candidateId: string | null;
  hasPriceMetadata: boolean;
  hasCollectorEvidence: boolean;
}) {
  if (!input.sessionInserted || !input.lineId || !input.stableScanId || !input.candidateId) {
    return { canRun: false, tasks: [] as ScannerParallelEnrichmentTaskName[], reason: 'Session line must exist before background enrichment.' };
  }
  const tasks: ScannerParallelEnrichmentTaskName[] = ['thumbnail'];
  if (!input.hasCollectorEvidence) tasks.push('collector_refinement', 'printing_disambiguation');
  tasks.push('finish_inference');
  if (input.hasPriceMetadata) tasks.push('pricing');
  return { canRun: true, tasks, reason: 'Background enrichment can update the inserted row without blocking the next scan.' };
}
