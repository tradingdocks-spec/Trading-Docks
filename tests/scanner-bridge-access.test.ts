import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scannerBridgeOwnerAccess } from "../src/lib/chaos-sort/scanner-bridge-access.ts";
import { contentSecurityPolicy } from "../src/lib/content-security-policy.ts";

const config = { userId: "approved-owner", workspaceId: "approved-workspace" };
function fixture(options: { active?: string; owner?: string; role?: string; error?: string; throws?: boolean } = {}) {
  const calls: Array<{ table: string; filters: Record<string, string> }> = [];
  const rows: Record<string, object> = {
    user_preferences: { active_workspace_id: options.active ?? config.workspaceId },
    workspaces: { owner_id: options.owner ?? config.userId },
    workspace_members: { role: options.role ?? "owner" },
  };
  const client = { from(table: string) {
    const call = { table, filters: {} as Record<string, string> }; calls.push(call);
    const query = {
      select() { return query; },
      eq(column: string, value: string) { call.filters[column] = value; return query; },
      async maybeSingle() {
        if (options.throws) throw new Error("unavailable");
        return { data: rows[table], error: options.error === table ? { message: "denied" } : null };
      },
    }; return query;
  } } as unknown as SupabaseClient;
  return { client, calls };
}

test("only the configured current owner in the configured active workspace is allowed", async () => {
  const f = fixture();
  assert.equal(await scannerBridgeOwnerAccess(f.client, { id: config.userId }, config), true);
  assert.deepEqual(f.calls, [
    { table: "user_preferences", filters: { user_id: config.userId } },
    { table: "workspaces", filters: { id: config.workspaceId } },
    { table: "workspace_members", filters: { workspace_id: config.workspaceId, user_id: config.userId } },
  ]);
});
for (const [name, user, cfg] of [
  ["anonymous", null, config],
  ["anonymous auth identity", { id: config.userId, is_anonymous: true }, config],
  ["other owner", { id: "other-owner" }, config],
  ["missing user allowlist", { id: config.userId }, { workspaceId: config.workspaceId }],
  ["missing workspace allowlist", { id: config.userId }, { userId: config.userId }],
] as const) test(`${name} cannot enable bridge or trigger gate queries`, async () => {
  const f = fixture(); assert.equal(await scannerBridgeOwnerAccess(f.client, user, cfg), false); assert.equal(f.calls.length, 0);
});
for (const [name, options] of [
  ["different active workspace", { active: "other-workspace" }],
  ["transferred ownership", { owner: "other-owner" }],
  ["delegated employee", { role: "employee" }],
  ["administrator", { role: "admin" }],
  ["manager", { role: "manager" }],
  ["preference query failure", { error: "user_preferences" }],
  ["ownership query failure", { error: "workspaces" }],
  ["membership query failure", { error: "workspace_members" }],
  ["network failure", { throws: true }],
] as const) test(`${name} fails closed`, async () => {
  assert.equal(await scannerBridgeOwnerAccess(fixture(options).client, { id: config.userId }, config), false);
});
test("CSP permits only exact HTTPS loopback for approved responses and retains other protections", () => {
  const off = contentSecurityPolicy(), on = contentSecurityPolicy(true);
  assert.ok(!off.includes("127.0.0.1"));
  assert.equal(on.replace(" https://127.0.0.1:47391", ""), off);
  assert.ok(on.includes("object-src 'none'"));
  assert.ok(on.includes("frame-ancestors 'none'"));
});
