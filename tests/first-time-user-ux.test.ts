import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("CSV intake explains its consequence before asking for confirmation", () => {
  const source = readFileSync(path.join(repoRoot, "src/components/dashboard/tools/CsvConversionEngine.tsx"), "utf8");

  assert.match(source, /Import or convert inventory files/);
  assert.match(source, /Upload file.*Review matches.*Choose destination.*Download or import/s);
  assert.match(source, /Import into inventory/);
  assert.match(source, /Import \{quantityTotal\.toLocaleString\(\)\} cards/);
  assert.match(source, /Cards imported into inventory/);
  assert.match(source, /View inventory/);
});

test("first-use help primitives remain accessible and progressive", () => {
  const source = readFileSync(path.join(repoRoot, "src/components/dashboard/help/HelpPrimitives.tsx"), "utf8");

  assert.match(source, /aria-labelledby="feature-intro-title"/);
  assert.match(source, /<details/);
  assert.match(source, /<summary/);
  assert.match(source, /aria-label="Workflow steps"/);
  assert.match(source, /focus-visible:ring-2/);
});

test("scanner copy does not imply that image lookup imports inventory", () => {
  const source = readFileSync(path.join(repoRoot, "src/components/dashboard/purchasing/CardPhotoScanner.tsx"), "utf8");

  assert.match(source, /Identify one card before you decide what to pay/);
  assert.match(source, /This tool does not add cards to inventory/);
  assert.match(source, /Review suggested printings/);
});
