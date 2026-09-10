// Loopback-only print QA fixtures. Uses the production document renderer and batch-detail component.
// This server and synthetic records are never included in a production route.
import http from "node:http";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as media from "../../src/lib/chaos-sort/label-media.ts";
import { renderChaosSortPrintDocument } from "../../src/lib/chaos-sort/print-document.ts";
import { renderChaosSortLabelSvg } from "../../src/lib/chaos-sort/batch-label.ts";
const require = createRequire(import.meta.url);
const exports = {};
const source = fs.readFileSync("src/components/dashboard/inventory/ChaosSortBatchDetail.tsx", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { exports, URLSearchParams, require: name => name === "@/lib/chaos-sort/label-media" ? media : require(name) });
const records = [1, 2].map(number => ({
  id: `00000000-0000-4000-8000-00000000000${number}`, batch_code: `CS-BATCH-00000${number}`, title: "Synthetic print QA batch", status: "committed", status_v2: "active",
  session_id: `11111111-1111-4111-8111-11111111111${number}`, session_code: `CS-SESSION-00000${number}`, destination_location_id: null,
  destination_label: number === 1 ? "BIN C04" : "Warehouse north / Rack D / Shelf 12 / BIN D05", initial_quantity: 300, current_quantity: number === 1 ? 300 : 72,
  created_at: "2026-09-09T12:00:00Z", completed_at: null,
}));
http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost:4187");
  const record = records.find(batch => url.pathname.includes(batch.id));
  if (url.pathname === "/") { response.end(`<a href="/dashboard/inventory/batches/${records[0].id}">Open batch one</a><a href="/dashboard/inventory/batches/${records[1].id}">Open batch two</a>`); return; }
  if (!record) { response.writeHead(404); response.end("Unknown fixture"); return; }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  if (url.searchParams.get("format") === "svg") {
    response.setHeader("Content-Type", "image/svg+xml");
    response.end(renderChaosSortLabelSvg(record, media.resolveLabelMedia(url.searchParams), new URL(`/dashboard/inventory/batches/${record.id}`, url.origin).href)); return;
  }
  if (url.pathname.endsWith("/print")) { response.end(renderChaosSortPrintDocument(record, url.href)); return; }
  const positions = Array.from({ length: 300 }, (_, index) => ({ id: `position-${index}`, card_name: `Card position ${index} - must not print`, quantity: 1, set_code: "SET", finish: "Nonfoil", condition: "NM" }));
  const data = { batch: record, session: { session_code: record.session_code, source: "Synthetic fixture", reference: null }, positions };
  response.end(`<!doctype html><html><head><title>Chaos Sort print QA</title></head><body><nav>App shell must not print</nav>${renderToStaticMarkup(React.createElement(exports.ChaosSortBatchDetail, { data }))}</body></html>`);
}).listen(4187, "127.0.0.1");
