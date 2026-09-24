import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { resolveLabelMedia, chaosSortLabelPrintHref } from "../src/lib/chaos-sort/label-media.ts";
import { renderChaosSortPrintDocument } from "../src/lib/chaos-sort/print-document.ts";
import { renderChaosSortLabelSvg, type ChaosSortLabelData } from "../src/lib/chaos-sort/batch-label.ts";

const batch: ChaosSortLabelData = { id: "batch-one", batch_code: "CS-BATCH-000001", session_id: "session-one", session_code: "CS-SESSION-000001", destination_label: "BIN C04", current_quantity: 72, initial_quantity: 100, created_at: "2026-09-09T12:00:00Z" };

test("committed physical batch label retains original count, exact identity, location, UTC commit and QR", () => {
  const svg = renderChaosSortLabelSvg({ ...batch, batch_code: "CS-000023", completed_at: "2026-09-23T21:40:00Z" }, resolveLabelMedia(new URLSearchParams("media=custom&width=100&height=70")), "https://example.invalid/batches/batch-one");
  for (const value of ["CS-000023", "BIN C04", "Physical cards: 100", "72 / 100 cards remaining", "batch-one", "2026-09-23", "21:40:00", "QR code for CS-000023"]) assert.ok(svg.includes(value), value);
});

test("media defaults match the existing DK-1201 format and never produce unsafe page CSS", () => {
  assert.deepEqual(resolveLabelMedia(new URLSearchParams()), { key: "dk1201", width: 29, height: 90, position: "top" });
  assert.equal(resolveLabelMedia(new URLSearchParams("media=dk1208")).width, 38);
  assert.equal(resolveLabelMedia(new URLSearchParams("media=dk1202")).height, 100);
  assert.deepEqual(resolveLabelMedia(new URLSearchParams("media=custom&width=57.15&height=31.75&position=bottom")), { key: "custom", width: 57.15, height: 31.75, position: "bottom" });
  const unsafe = resolveLabelMedia(new URLSearchParams("media=custom&width=1;display:block&height=Infinity&position=bad"));
  assert.equal(unsafe.width, 29); assert.equal(unsafe.height, 90); assert.equal(unsafe.position, "top");
  assert.equal(resolveLabelMedia(new URLSearchParams("media=__proto__")).key, "dk1201");
});

test("the normal action and preview target the same single-batch document with distinct print intent", () => {
  const media = resolveLabelMedia(new URLSearchParams("media=dk1202&position=center"));
  const print = chaosSortLabelPrintHref("batch/a", media);
  assert.match(print, /labels\/batch%2Fa\/print\?media=dk1202&position=center&autoprint=1$/);
  assert.match(chaosSortLabelPrintHref("batch/a", media, "preview"), /&preview=1$/);
  assert.doesNotMatch(print, /copies|items|all=/);
  const detail = readFileSync(new URL("../src/components/dashboard/inventory/ChaosSortBatchDetail.tsx", import.meta.url), "utf8");
  assert.match(detail, /<a href=\{chaosSortLabelPrintHref\(data.batch.id, media\)\}/);
  assert.match(detail, /<img key=\{data.batch.id\}/);
  assert.doesNotMatch(detail, /window\.print|@media print|label-sheet|QRCode/);
});

test("one root and one inline vector label print regardless of bulk/copies query parameters", () => {
  const html = renderChaosSortPrintDocument(batch, "https://www.tradingdocks.com/dashboard/inventory/chaos-sort/labels/batch-one/print?autoprint=1&copies=999&all=true");
  assert.equal((html.match(/<main class="chaos-sort-label-print-root"/g) ?? []).length, 1);
  assert.match(html, /@page \{ size: 29mm 90mm; margin: 0; \}/);
  assert.match(html, /body > :not\(\.chaos-sort-label-print-root\) \{ display: none !important/);
  assert.doesNotMatch(html, /visibility: hidden|@page[^}]*var\(|<iframe|<table|<img|_next\/|DashboardShell/);
  assert.match(html, /CS-BATCH-000001/);
  assert.match(html, /BIN C04/);
  assert.match(html, /72 \/ 100 cards/);
  assert.match(html, /automaticPrintStarted = true; printLabel\(\)/);
  assert.match(html, /document.fonts.ready/);
});

test("label fields are escaped and a preview cannot auto-print", () => {
  const html = renderChaosSortPrintDocument({ ...batch, batch_code: '<script>alert("x")</script>', destination_label: '<img src=x onerror="alert(1)">' }, "https://www.tradingdocks.com/print?preview=1&autoprint=1");
  assert.doesNotMatch(html, /<script>alert|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /if \(false && !automaticPrintStarted\)/);
});

// Execute the production handler with a mocked Supabase boundary; no test-only auth path ships.
function routeHarness(user: { id: string } | null, result: ChaosSortLabelData | null = batch, failure = false) {
  const queries: Array<{ table: string; filters: Array<[string, string]> }> = [];
  const supabase = { auth: { getUser: async () => ({ data: { user } }) }, from(table: string) {
    const query = { table, filters: [] as Array<[string, string]> }; queries.push(query);
    const builder = { select: () => builder, eq: (key: string, value: string) => { query.filters.push([key, value]); return builder; }, maybeSingle: async () => ({ data: table === "chaos_sort_batches" ? result : { session_code: "CS-SESSION-000001" }, error: failure ? new Error("unavailable") : null }) };
    return builder;
  } };
  const source = readFileSync(new URL("../src/app/dashboard/inventory/chaos-sort/labels/[batchId]/print/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { GET?: (request: Request, context: { params: Promise<{ batchId: string }> }) => Promise<Response> } = {};
  vm.runInNewContext(code, { exports, Request, Response, URL, require: (name: string) => {
    if (name === "@/lib/supabase/server") return { createClient: async () => supabase };
    if (name === "@/lib/chaos-sort/print-document") return { renderChaosSortPrintDocument };
    if (name === "@/lib/chaos-sort/batch-label") return { renderChaosSortLabelSvg };
    if (name === "@/lib/chaos-sort/label-media") return { resolveLabelMedia };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { queries, get: (query = "") => exports.GET!(new Request("https://www.tradingdocks.com/dashboard/inventory/chaos-sort/labels/batch-one/print" + query), { params: Promise.resolve({ batchId: "batch-one" }) }) };
}

test("print handler scopes a single batch and session to the signed-in user without loading positions", async () => {
  const harness = routeHarness({ id: "owner-one" });
  const response = await harness.get();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /private, no-store/);
  assert.deepEqual(harness.queries, [
    { table: "chaos_sort_batches", filters: [["id", "batch-one"], ["user_id", "owner-one"]] },
    { table: "chaos_sort_sessions", filters: [["id", "session-one"], ["user_id", "owner-one"]] },
  ]);
});

test("unauthenticated, missing and failed lookups never produce printable labels", async () => {
  const anonymous = routeHarness(null);
  assert.equal((await anonymous.get()).status, 303);
  assert.equal(anonymous.queries.length, 0);
  assert.equal((await routeHarness({ id: "other-owner" }, null).get()).status, 404);
  const failed = await routeHarness({ id: "owner-one" }, batch, true).get();
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /chaos-sort-label-print-root/);
});


test("screen preview is a script-free SVG image under the existing frame-blocking policy", async () => {
  const response = await routeHarness({ id: "owner-one" }).get("?preview=1&format=svg");
  assert.equal(response.headers.get("content-type"), "image/svg+xml; charset=utf-8");
  const svg = await response.text();
  assert.match(svg, /^<svg xmlns=/);
  assert.doesNotMatch(svg, /<script|<iframe|<main/);
});
