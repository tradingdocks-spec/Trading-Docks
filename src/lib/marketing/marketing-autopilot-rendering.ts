import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { buildAutopilotRenderSpec, type AutopilotPackage } from "./marketing-autopilot";
import { renderCreativeSvg, validateRenderSpec, type CreativePlatform } from "./creative-renderer";

export type RenderedAutopilotVariant = { platform: CreativePlatform; width: number; height: number; filename: string; png: Buffer };

export async function renderAutopilotVariants(packageData: AutopilotPackage, productPng: Buffer) {
  const productAssetUrl = `data:image/png;base64,${productPng.toString("base64")}`;
  const logo = await readFile("public/Brand/trading-docks-horizontal.png");
  const logoAssetUrl = `data:image/png;base64,${logo.toString("base64")}`;
  const variants: RenderedAutopilotVariant[] = [];
  for (const variant of packageData.variants) {
    const spec = buildAutopilotRenderSpec({ package: packageData, platform: variant.platform, productAssetUrl });
    spec.logoAssetUrl = logoAssetUrl;
    const issues = validateRenderSpec(spec);
    if (issues.length) throw new Error(`Creative render blocked: ${issues.join(", ")}.`);
    const png = await sharp(Buffer.from(renderCreativeSvg(spec))).png().toBuffer();
    variants.push({ platform: variant.platform, width: variant.width, height: variant.height, filename: variant.filename, png });
  }
  return variants;
}
