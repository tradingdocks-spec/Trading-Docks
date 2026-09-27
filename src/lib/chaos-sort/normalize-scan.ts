import sharp from "sharp";

/** Recognition-only derivative. Never replaces the archived scanner capture. */
export async function normalizeScan(bytes: Uint8Array, rotation = 0) {
  if (![0, 90, 180, 270].includes(rotation)) throw new Error("Invalid scan rotation");
  const oriented = await sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error" }).rotate().toBuffer();
  const { data, info } = await sharp(oriented).rotate(rotation).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  // Sample visible content; retain a generous margin around the card
  // content so a printed black border is not mistaken for scanner background.
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) {
      const i = (y * info.width + x) * info.channels;
      if (Math.max(data[i], data[i + Math.min(1, info.channels - 1)], data[i + Math.min(2, info.channels - 1)]) > 28) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  const margin = Math.ceil(Math.max(info.width, info.height) * 0.02);
  left = Math.max(0, left - margin); top = Math.max(0, top - margin);
  right = Math.min(info.width - 1, right + margin); bottom = Math.min(info.height - 1, bottom + margin);
  const width = right - left + 1, height = bottom - top + 1;
  let image = sharp(data, { raw: info });
  // Ambiguous/dark captures retain the entire frame for manual review.
  if (width >= info.width * 0.7 && height >= info.height * 0.7 && width > 0 && height > 0) image = image.extract({ left, top, width, height });
  return image.resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
}
