import { test } from "node:test";
import assert from "node:assert/strict";
import { privateAcceptanceRequestAllowed, privateAcceptanceScanAllowed } from "../src/lib/chaos-sort/private-acceptance.ts";

test("private preview blocks inventory/payment mutations and server actions", () => {
  for (const path of ["/api/inventory", "/api/pos", "/dashboard", "/api/inventory/a.jpg"]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(privateAcceptanceRequestAllowed(path, method), false);
  }
  assert.equal(privateAcceptanceRequestAllowed("/api/chaos-sort/scans", "POST"), true);
  assert.equal(privateAcceptanceRequestAllowed("/api/purchasing/card-photo-scan", "POST"), true);
});

test("only existing approved batch intake/review is permitted; commit and creation denied", () => {
  const previous = process.env.SCANNER_PRIVATE_ACCEPTANCE_BATCH_ID;
  process.env.SCANNER_PRIVATE_ACCEPTANCE_BATCH_ID = "approved-batch";
  try {
    for (const action of ["authorize-capture", "start", "review", "upload"]) {
      assert.equal(privateAcceptanceScanAllowed(action, "approved-batch"), true);
      assert.equal(privateAcceptanceScanAllowed(action, "other-batch"), false);
    }
    for (const action of ["create", "commit", "csv", "label", "settings", "mode"]) assert.equal(privateAcceptanceScanAllowed(action, "approved-batch"), false);
    delete process.env.SCANNER_PRIVATE_ACCEPTANCE_BATCH_ID;
    assert.equal(privateAcceptanceScanAllowed("upload", undefined), false);
  } finally {
    if (previous === undefined) delete process.env.SCANNER_PRIVATE_ACCEPTANCE_BATCH_ID;
    else process.env.SCANNER_PRIVATE_ACCEPTANCE_BATCH_ID = previous;
  }
});
