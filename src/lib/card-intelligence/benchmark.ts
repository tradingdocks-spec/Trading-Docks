export type ScannerBenchmarkFixture = {
  id: string; game: "magic" | "pokemon"; exactPrintingId: string; cardName: string; setCode?: string | null;
  collectorNumber?: string | null; finish?: string | null; language?: string | null;
  conditions?: { glare?: boolean; blur?: boolean; perspective?: boolean; alternateTreatment?: boolean };
  imageFixture?: string; expectedTop1?: boolean; expectedTop3?: boolean;
};
export type ScannerBenchmarkObservation = { fixtureId: string; candidateIds: string[]; confidenceTier: "high" | "medium" | "low"; requiresConfirmation: boolean };

export function calculateScannerBenchmark(fixtures: ScannerBenchmarkFixture[], observations: ScannerBenchmarkObservation[]) {
  const byId = new Map(observations.map((entry) => [entry.fixtureId, entry]));
  const evaluated = fixtures.flatMap((fixture) => { const observation = byId.get(fixture.id); return observation ? [{ fixture, observation }] : []; });
  const ratio = (count: number) => evaluated.length ? count / evaluated.length : null;
  return {
    fixtureCount: fixtures.length, evaluatedCount: evaluated.length,
    top1Accuracy: ratio(evaluated.filter(({ fixture, observation }) => observation.candidateIds[0] === fixture.exactPrintingId).length),
    top3Accuracy: ratio(evaluated.filter(({ fixture, observation }) => observation.candidateIds.slice(0, 3).includes(fixture.exactPrintingId)).length),
    exactPrintingAccuracy: ratio(evaluated.filter(({ fixture, observation }) => observation.candidateIds[0] === fixture.exactPrintingId).length),
    falseHighConfidenceRate: ratio(evaluated.filter(({ fixture, observation }) => observation.confidenceTier === "high" && observation.candidateIds[0] !== fixture.exactPrintingId).length),
    confirmationRate: ratio(evaluated.filter(({ observation }) => observation.requiresConfirmation).length),
  };
}
