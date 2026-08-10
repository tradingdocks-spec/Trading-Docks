import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  runMagicBenchmark,
  serializeMagicBenchmarkCsv,
  serializeMagicBenchmarkJson,
  serializeMagicBenchmarkMarkdown,
  validateMagicBenchmarkFixtureManifest,
} from '../services/magic-recognition-provider.ts';

type CliArgs = {
  manifestPath: string | null;
  outputDir: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifestPath) {
    throw new Error('Usage: npm run benchmark:magic-scanner -- --manifest <private-manifest.json> [--output mobile/benchmark-output/magic]');
  }
  const raw = await readFile(args.manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const validation = validateMagicBenchmarkFixtureManifest(parsed);
  if (!validation.ok) {
    throw new Error(`Invalid Magic scanner benchmark manifest:\n${validation.errors.map((error) => `- ${error}`).join('\n')}`);
  }
  const report = await runMagicBenchmark(validation.manifest);
  await mkdir(args.outputDir, { recursive: true });
  const baseName = sanitizeFileName(`${validation.manifest.fixtureSetId}-${report.generatedAt}`);
  await writeFile(path.join(args.outputDir, `${baseName}.json`), serializeMagicBenchmarkJson(report), 'utf8');
  await writeFile(path.join(args.outputDir, `${baseName}.csv`), serializeMagicBenchmarkCsv(report), 'utf8');
  await writeFile(path.join(args.outputDir, `${baseName}.md`), serializeMagicBenchmarkMarkdown(report), 'utf8');
  process.stdout.write(`Magic scanner benchmark complete.\n`);
  process.stdout.write(`Fixtures: ${report.fixtureCount}\n`);
  process.stdout.write(`Output: ${args.outputDir}\n`);
  process.stdout.write(`Image paths exported: no\n`);
}

function parseArgs(argv: string[]): CliArgs {
  let manifestPath: string | null = null;
  let outputDir = path.join(process.cwd(), 'benchmark-output', 'magic-scanner');
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--manifest') {
      manifestPath = argv[index + 1] ?? null;
      index += 1;
    } else if (current === '--output') {
      outputDir = argv[index + 1] ?? outputDir;
      index += 1;
    }
  }
  return {
    manifestPath: manifestPath ? path.resolve(manifestPath) : null,
    outputDir: path.resolve(outputDir),
  };
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 120);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
