import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { POS_ERRORS } from "../src/lib/pos/domain.ts";
function load(path: string, deps: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      Response,
      URL,
      TextDecoder,
      console: { warn() {} },
      require: (name: string) => {
        if (!(name in deps)) throw new Error(name);
        return deps[name];
      },
    },
  );
  return exports;
}
const origin = "http://localhost:3000";
const server = (access: unknown) =>
  load("src/lib/label-studio/server.ts", {
    "@/lib/platform/server-access": {
      requireApiCapability: async () => access,
    },
    "@/lib/pos/domain": { POS_ERRORS },
  });
test("label mutations reject foreign origins, oversized streams and malformed bodies", async () => {
  const s = server({ ok: false });
  await assert.rejects(
    s.labelBody(
      new Request(origin, {
        method: "POST",
        headers: { origin: "https://other.test" },
        body: "{}",
      }),
    ),
    /origin/,
  );
  await assert.rejects(
    s.labelBody(
      new Request(origin, {
        method: "POST",
        headers: { origin },
        body: "x".repeat(65537),
      }),
    ),
    /large/,
  );
  await assert.rejects(
    s.labelBody(
      new Request(origin, { method: "POST", headers: { origin }, body: "[]" }),
    ),
    /Invalid/,
  );
});
test("label context never accepts a browser supplied workspace", async () => {
  const result = (await server({
    ok: true,
    access: { workspaceId: "trusted" },
    supabase: { rpc: async (name: string, args: { p_workspace_id: string }) => {
      assert.equal(name, "label_access");
      assert.equal(args.p_workspace_id, "trusted");
      return { data: true, error: null };
    } },
  }).labelContext()) as { workspaceId: string };
  assert.equal(result.workspaceId, "trusted");
  const denied = (await server({
    ok: false,
    response: Response.json({}, { status: 401 }),
  }).labelContext()) as { response: Response };
  assert.equal(denied.response.status, 401);
});
test("label application entitlement cannot override database denial", async () => {
  for (const rpcResult of [{ data: false, error: null }, { data: null, error: { message: "POS_FORBIDDEN" } }]) {
    const result = await server({ ok: true, access: { workspaceId: "trusted" },
      supabase: { rpc: async () => rpcResult },
    }).labelContext("label.manage_templates") as { ok: boolean; response: Response };
    assert.equal(result.ok, false);
    assert.equal(result.response.status, 403);
  }
});
test("label target issue preserves exact IDs and trusted scope across target classes", async () => {
  const calls: unknown[] = [];
  const s = server({});
  const result = await s.issueLabelTargets(
    {
      ok: true,
      workspaceId: "trusted",
      supabase: {
        rpc: async (name: string, args: unknown) => {
          calls.push({ name, args });
          return { data: [], error: null };
        },
      },
    },
    ["position-1", "location:case"],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      name: "label_targets",
      args: { p_workspace_id: "trusted", p_ids: ["position-1"], p_issue: true },
    },
    {
      name: "label_locations",
      args: { p_workspace_id: "trusted", p_ids: ["case"], p_issue: true },
    },
  ]);
});
test("label print API rejects forged quantities before resolving inventory", async () => {
  let called = false;
  const api = load("src/app/api/label-studio/print/route.ts", {
    "@/lib/label-studio/server": {
      labelBody: async () => ({
        template: {},
        queue: [{ key: "item", copies: -1 }],
      }),
      labelContext: async () => ({ ok: true, workspaceId: "trusted" }),
      labelFailure: () => Response.json({}, { status: 400 }),
      issueLabelTargets: async () => {
        called = true;
        return [];
      },
    },
    "@/lib/label-studio/print-document": { buildLabelDocument: async () => "" },
    "@/lib/label-studio/print-settings": { DEFAULT_PRINT_SETTINGS: {} },
    "@/lib/label-studio/label-templates": {
      validateLabelTemplate: () => ({ ok: true }),
    },
  });
  const response = (await api.POST(new Request(origin))) as Response;
  assert.equal(response.status, 400);
  assert.equal(called, false);
});
