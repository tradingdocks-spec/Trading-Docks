import path from "node:path";

export type TcgTrackingScanFixtureInput = {
  id?: unknown;
  filename?: unknown;
  localImagePath?: unknown;
  expectedProductId?: unknown;
  expectedTcgplayerProductId?: unknown;
  expectedName?: unknown;
  expectedSet?: unknown;
  expectedSetName?: unknown;
  expectedCollectorNumber?: unknown;
  treatment?: unknown;
  notes?: unknown;
};

export type TcgTrackingScanFixture = {
  id: string;
  imagePath: string;
  expectedName: string;
  expectedSetName?: string;
  expectedCollectorNumber?: string;
  expectedTcgplayerProductId?: number;
  treatment?: string;
  notes?: string;
};

export type TcgTrackingScanBenchmarkResult = {
  fixtureId: string;
  treatment?: string;
  expectedName: string;
  expectedSetName?: string;
  expectedCollectorNumber?: string;
  expectedTcgplayerProductId?: number;
  status: string;
  latencyMs: number;
  top1Match: boolean;
  top3Match: boolean;
  unresolved: boolean;
  incorrectPrinting: boolean;
};

export function normalizeTcgTrackingScanManifest(
  value: unknown,
  options: { manifestPath: string; fixtureRoot?: string },
) {
  const manifest = value && typeof value === "object"
    ? value as { fixtureSetId?: unknown; fixtures?: unknown }
    : {};
  if (!Array.isArray(manifest.fixtures)) {
    throw new Error("Manifest must include a fixtures array.");
  }

  const manifestDirectory = path.dirname(path.resolve(options.manifestPath));
  const fixtureRoot = path.resolve(
    options.fixtureRoot ?? manifestDirectory,
  );

  return {
    fixtureSetId: textValue(manifest.fixtureSetId) ?? "tcgtracking-private-fixtures",
    fixtures: manifest.fixtures.map((entry, index) =>
      normalizeFixture(entry as TcgTrackingScanFixtureInput, {
        index,
        fixtureRoot,
      }),
    ),
  };
}

export function summarizeTcgTrackingScanBenchmark(
  results: TcgTrackingScanBenchmarkResult[],
) {
  return {
    imagePathsExported: false,
    fixtureCount: results.length,
    top1Accuracy: ratio(
      results.filter((result) => result.top1Match).length,
      results.length,
    ),
    top3Accuracy: ratio(
      results.filter((result) => result.top3Match).length,
      results.length,
    ),
    unresolvedRate: ratio(
      results.filter((result) => result.unresolved).length,
      results.length,
    ),
    incorrectPrintingRate: ratio(
      results.filter((result) => result.incorrectPrinting).length,
      results.length,
    ),
    averageLatencyMs: average(results.map((result) => result.latencyMs)),
  };
}

function normalizeFixture(
  input: TcgTrackingScanFixtureInput,
  context: { index: number; fixtureRoot: string },
): TcgTrackingScanFixture {
  const id = textValue(input.id) ?? `fixture-${context.index + 1}`;
  const expectedName = textValue(input.expectedName);
  const requestedPath =
    textValue(input.filename) ?? textValue(input.localImagePath);

  if (!requestedPath) {
    throw new Error(`Fixture ${id} must include filename or localImagePath.`);
  }
  if (!expectedName) {
    throw new Error(`Fixture ${id} must include expectedName.`);
  }
  if (path.isAbsolute(requestedPath)) {
    throw new Error(`Fixture ${id} must use a relative private fixture path.`);
  }

  const resolvedPath = path.resolve(context.fixtureRoot, requestedPath);
  if (
    resolvedPath !== context.fixtureRoot &&
    !resolvedPath.startsWith(`${context.fixtureRoot}${path.sep}`)
  ) {
    throw new Error(`Fixture ${id} escapes the private fixture directory.`);
  }

  return {
    id,
    imagePath: resolvedPath,
    expectedName,
    expectedSetName:
      textValue(input.expectedSetName) ?? textValue(input.expectedSet),
    expectedCollectorNumber: textValue(input.expectedCollectorNumber),
    expectedTcgplayerProductId:
      integerValue(input.expectedTcgplayerProductId) ??
      integerValue(input.expectedProductId),
    treatment: textValue(input.treatment),
    notes: textValue(input.notes),
  };
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function integerValue(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return undefined;
}

function ratio(count: number, total: number) {
  return total > 0 ? count / total : null;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}
