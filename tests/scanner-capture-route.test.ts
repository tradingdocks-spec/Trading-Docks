import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("capture API rejects a capability-authorized but unapproved caller before snapshot or signing", async () => {
  let checked = 0;
  const user = { id: "other-owner" };
  const supabase = { rpc() { throw new Error("Unauthorized snapshot"); } };
  const compiledModule = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const source = readFileSync(new URL("../src/app/api/chaos-sort/scans/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports: compiledModule.exports, module: compiledModule, Response, Request, process,
    require(name: string) {
      if (name === "@/lib/platform/server-access") return { requireApiCapability: async () => ({ ok: true, user, supabase }) };
      if (name === "@/lib/chaos-sort/scanner-bridge-access") return { scannerBridgeOwnerAccess: async (client: unknown, identity: unknown) => { assert.equal(client, supabase); assert.equal(identity, user); checked++; return false; } };
      if (name === "@/lib/chaos-sort/capture-permit") return { issueCapturePermit() { throw new Error("Unauthorized signing"); } };
      if (name === "node:crypto" || name === "sharp") return {};
      if (name === "@/lib/supabase/admin" || name === "@/lib/chaos-sort/trusted-commit") return new Proxy({}, { get() { throw new Error('Unauthorized validation'); } });
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const response = await compiledModule.exports.POST(new Request("https://example.invalid/api/chaos-sort/scans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "authorize-capture", payload: { batchId: "batch" } }) }));
  assert.equal(response.status, 403);
  assert.equal(checked, 1);
});
