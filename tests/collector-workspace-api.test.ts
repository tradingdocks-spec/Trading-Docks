import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Collector Workspace mutation API does not cap Free-plan quantity checks at one page", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/app/api/collector-workspace/mutations/route.ts"),
    "utf8",
  );

  assert.match(source, /async function totalOwnedCardQuantity/);
  assert.match(source, /\.range\(from, from \+ pageSize - 1\)/);
  assert.doesNotMatch(source, /\.select\("quantity"\)\.eq\("user_id", user\.id\)\.limit\(1000\)/);
});
