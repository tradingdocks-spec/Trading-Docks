import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const studio = readFileSync("src/components/dashboard/admin/marketing/CreativeRendererWorkspace.tsx", "utf8");

test("Creative Studio exposes the five-step workflow with distinct labeled controls", () => {
  for (const section of ["Campaign setup", "Creative direction", "Product proof", "Copy", "Preview / export"]) assert.match(studio, new RegExp(section));
  for (const label of ["Feature", "Campaign", "Platform", "Product screenshot", "Headline", "Supporting copy", "CTA"]) assert.match(studio, new RegExp(`label=\\\"${label}\\\"`));
  assert.match(studio, /No approved screenshot selected/);
  assert.match(studio, /No draft campaign selected/);
});

test("Creative direction cards remain keyboard and screen-reader selectable", () => {
  assert.match(studio, /role=\"radiogroup\"/);
  assert.match(studio, /role=\"radio\"/);
  assert.match(studio, /aria-checked=\{selected\}/);
  assert.match(studio, /Generate 3/);
});

test("Creative Studio preserves existing save, export, renderer, and screenshot contracts", () => {
  assert.match(studio, /action: \"save\"/);
  assert.match(studio, /exportCreative\(\"png\"\)/);
  assert.match(studio, /exportCreative\(\"jpeg\"\)/);
  assert.match(studio, /renderCreativeSvg\(spec\)/);
  assert.match(studio, /selectChaosSortScreenshot/);
  assert.match(studio, /mark_gold_standard/);
});
