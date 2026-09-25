import sharp from "sharp";

export const CARD_ORIENTATIONS = [0, 90, 180, 270] as const;
export type CardRotation = typeof CARD_ORIENTATIONS[number];
export type OrientationResult = {
  rotationAppliedDegrees: CardRotation;
  confidence: number;
  source: "vision-four-view" | "manual" | "ambiguous";
  reviewRequired: boolean;
};

const MIN_ORIENTATION_CONFIDENCE = 0.8;

export function resolveOrientationEvidence(degrees: unknown, confidence: unknown): OrientationResult {
  const validDegrees = CARD_ORIENTATIONS.includes(degrees as CardRotation);
  const value = typeof confidence === "number" && Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence))
    : 0;
  if (!validDegrees || value < MIN_ORIENTATION_CONFIDENCE) {
    return { rotationAppliedDegrees: 0, confidence: value, source: "ambiguous", reviewRequired: true };
  }
  return { rotationAppliedDegrees: degrees as CardRotation, confidence: value, source: "vision-four-view", reviewRequired: false };
}

export function nextManualRotation(current: number, direction: "left" | "right"): CardRotation {
  const normalized = ((current % 360) + 360) % 360;
  const delta = direction === "left" ? -90 : 90;
  return (((normalized + delta + 360) % 360) as CardRotation);
}

/** Auto-applies EXIF once, then creates bounded pixel candidates for orientation comparison. */
export async function buildOrientationCandidates(bytes: Buffer) {
  const uprightExif = await sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();
  return Promise.all(CARD_ORIENTATIONS.map(async degrees => ({
    degrees,
    bytes: degrees === 0 ? uprightExif : await sharp(uprightExif).rotate(degrees).jpeg({ quality: 78 }).toBuffer(),
  })));
}
