import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { buildOrientationCandidates, nextManualRotation, resolveOrientationEvidence } from "../src/lib/card-photo-scanner/orientation.ts";

test("orientation candidates include every quarter-turn after EXIF normalization", async () => {
  const svg = Buffer.from('<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="480" fill="#f4e8c1"/><rect x="8" y="8" width="70" height="70" fill="#ff0000"/><text x="20" y="140" font-size="28">CARD NAME</text><text x="20" y="430" font-size="18">SET 123</text></svg>');
  const fixture = await sharp(svg).png().toBuffer();
  for (const degrees of [0, 90, 180, 270] as const) {
    const input = degrees === 0 ? fixture : await sharp(fixture).rotate(degrees).png().toBuffer();
    const candidates = await buildOrientationCandidates(input);
    assert.deepEqual(candidates.map(candidate => candidate.degrees), [0, 90, 180, 270]);
    for (const candidate of candidates) {
      const metadata = await sharp(candidate.bytes).metadata();
      assert.equal(metadata.format, "jpeg");
      assert.ok(metadata.width && metadata.height && metadata.width <= 1600 && metadata.height <= 1600);
    }
    const correction = (360 - degrees) % 360;
    const upright = candidates.find(candidate => candidate.degrees === correction)!;
    const { data, info } = await sharp(upright.bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const marker = (30 * info.width + 30) * info.channels;
    assert.ok(data[marker] > 180 && data[marker + 1] < 100 && data[marker + 2] < 100, `top-left marker restored for ${degrees}° source`);
  }
});

test("orientation evidence selects confident quarter-turns and fails closed on ambiguity", () => {
  for (const degrees of [0, 90, 180, 270] as const) {
    const result = resolveOrientationEvidence(degrees, 0.91);
    assert.equal(result.rotationAppliedDegrees, degrees);
    assert.equal(result.reviewRequired, false);
  }
  assert.deepEqual(resolveOrientationEvidence(180, 0.61), {
    rotationAppliedDegrees: 0, confidence: 0.61, source: "ambiguous", reviewRequired: true,
  });
  assert.equal(resolveOrientationEvidence(45, 0.99).reviewRequired, true);
});

test("manual orientation controls cycle without changing scan identity", () => {
  assert.equal(nextManualRotation(0, "left"), 270);
  assert.equal(nextManualRotation(270, "right"), 0);
  assert.equal(nextManualRotation(90, "right"), 180);
});
