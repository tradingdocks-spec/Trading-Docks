import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(repoRoot, "src/lib/collector-portfolio-server.ts"), "utf8");

test("Portfolio reads canonical inventory fields and excludes zero-quantity rows", () => {
  assert.match(source, /select\("id,card_name,quantity,location_id,inventory_value,game_id,product_type,set_code,variant,data"\)/);
  assert.match(source, /\.gt\("quantity", 0\)/);
  assert.match(source, /value\.card_name/);
  assert.match(source, /value\.inventory_value/);
  assert.match(source, /value\.location_id/);
});

