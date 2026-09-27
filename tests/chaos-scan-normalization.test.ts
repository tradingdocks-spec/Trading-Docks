import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeScan } from "../src/lib/chaos-sort/normalize-scan.ts";

test("black scanner border is normalized at all four orientations without mutating the source", async () => {
  const card = await sharp({ create: { width: 250, height: 350, channels: 3, background: "#aacc88" } }).png().toBuffer();
  const source = await sharp(card).extend({ top: 25, bottom: 25, left: 25, right: 25, background: "black" }).png().toBuffer();
  for (const angle of [0, 90, 180, 270]) {
    const input = await sharp(source).rotate(angle).png().toBuffer(); const original = Buffer.from(input);
    const output = await normalizeScan(input, (360 - angle) % 360);
    const metadata = await sharp(output).metadata();
    assert.ok(metadata.width! >= 250 && metadata.width! < 300);
    assert.ok(metadata.height! >= 350 && metadata.height! < 400);
    assert.deepEqual(input, original);
  }
});
test("ambiguous black scans retain their frame; unsupported rotations fail closed", async () => {
  const source = await sharp({ create: { width: 250, height: 350, channels: 3, background: "black" } }).png().toBuffer();
  const metadata = await sharp(await normalizeScan(source)).metadata();
  assert.equal(metadata.width, 250); assert.equal(metadata.height, 350);
  await assert.rejects(normalizeScan(source, 45), /Invalid scan rotation/);
});
