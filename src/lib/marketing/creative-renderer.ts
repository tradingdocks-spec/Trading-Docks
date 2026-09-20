export const CREATIVE_FORMATS = {
  instagram_square: { label: "Instagram Feed", width: 1080, height: 1080 },
  instagram_portrait: { label: "Instagram Portrait", width: 1080, height: 1350 },
  instagram_story: { label: "Instagram Story", width: 1080, height: 1920 },
  facebook: { label: "Facebook", width: 1200, height: 1200 },
  google_square: { label: "Google Square", width: 1200, height: 1200 },
  google_landscape: { label: "Google Landscape", width: 1200, height: 628 },
  email: { label: "Email", width: 1200, height: 628 },
  linkedin: { label: "LinkedIn", width: 1200, height: 628 },
  x: { label: "X", width: 1200, height: 628 },
} as const;

export type CreativePlatform = keyof typeof CREATIVE_FORMATS;
export type CompositionFamily = "product_hero" | "product_cards" | "feature_spotlight" | "operational_pain" | "workflow" | "minimal_editorial" | "before_after" | "editorial_tcg" | "data_story" | "campaign_carousel";

export type CreativeRenderSpec = {
  version: 1;
  composition: CompositionFamily;
  platform: CreativePlatform;
  width: number;
  height: number;
  headline: string;
  subheadline: string;
  cta: string;
  featureName: string;
  logoVariant: "wordmark" | "mark";
  logoAssetUrl?: string;
  productAssetUrl?: string;
  supportingAssetUrls?: string[];
  background: "navy" | "paper";
  conceptDirection?: "product" | "transformation" | "editorial";
  logoPlacement?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "footer_lockup";
  brandProfileVersion?: number;
  campaignVisualFamilyId?: string;
};

export const SUPPORTED_COMPOSITIONS: Array<{ value: CompositionFamily; label: string; description: string }> = [
  { value: "product_hero", label: "Product Hero", description: "Product-first with one strong message." },
  { value: "product_cards", label: "Product + Cards", description: "Product UI supported by approved card imagery." },
  { value: "feature_spotlight", label: "Feature Spotlight", description: "Feature name, benefit, and screenshot." },
  { value: "operational_pain", label: "Operational Pain", description: "A real workflow problem, then the product response." },
  { value: "workflow", label: "Workflow", description: "A restrained scan-to-shelf operating sequence." },
  { value: "minimal_editorial", label: "Minimal Editorial", description: "Typography-led with generous negative space." },
  { value: "before_after", label: "Before / After", description: "Operational pain resolved by an authentic product workflow." },
  { value: "editorial_tcg", label: "Editorial TCG", description: "Premium card imagery with restrained product context." },
  { value: "data_story", label: "Data Story", description: "A clear operational narrative without fabricated metrics." },
  { value: "campaign_carousel", label: "Campaign Carousel", description: "A connected sequence of campaign frames." },
];

export function formatForPlatform(platform: CreativePlatform) {
  return CREATIVE_FORMATS[platform] ?? CREATIVE_FORMATS.email;
}

export function buildRenderSpec(input: Partial<CreativeRenderSpec> & Pick<CreativeRenderSpec, "featureName" | "headline" | "subheadline" | "cta">): CreativeRenderSpec {
  const platform = input.platform && input.platform in CREATIVE_FORMATS ? input.platform : "email";
  const format = formatForPlatform(platform);
  return {
    version: 1,
    composition: input.composition ?? "product_hero",
    platform,
    width: format.width,
    height: format.height,
    headline: input.headline.trim().slice(0, 72),
    subheadline: input.subheadline.trim().slice(0, 150),
    cta: input.cta.trim().slice(0, 36),
    featureName: input.featureName.trim().slice(0, 48),
    logoVariant: input.logoVariant ?? "wordmark",
    logoAssetUrl: input.logoAssetUrl ?? "/Brand/trading-docks-horizontal.png",
    productAssetUrl: input.productAssetUrl,
    supportingAssetUrls: input.supportingAssetUrls ?? [],
    background: input.background ?? "navy",
    conceptDirection: input.conceptDirection,
    logoPlacement: input.logoPlacement ?? "top_right",
    brandProfileVersion: input.brandProfileVersion ?? 1,
    campaignVisualFamilyId: input.campaignVisualFamilyId,
  };
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export type CreativeRect = { x: number; y: number; width: number; height: number };
export type TextFit = { lines: string[]; fontSize: number; rect: CreativeRect };

function wrapText(value: string, maxChars: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) { lines.push(current); current = word; } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

export function fitText(input: { text: string; maxWidth: number; maxHeight: number; maxFontSize: number; minFontSize: number; maxLines: number }): TextFit | null {
  for (let fontSize = input.maxFontSize; fontSize >= input.minFontSize; fontSize -= 2) {
    const maxChars = Math.max(1, Math.floor(input.maxWidth / (fontSize * .56)));
    const lines = wrapText(input.text, maxChars, input.maxLines);
    const lineHeight = Math.round(fontSize * 1.08);
    const height = lines.length * lineHeight;
    const longest = Math.max(0, ...lines.map((line) => line.length));
    if (lines.length <= input.maxLines && height <= input.maxHeight && longest * fontSize * .56 <= input.maxWidth) return { lines, fontSize, rect: { x: 0, y: 0, width: input.maxWidth, height } };
  }
  return null;
}

function intersects(left: CreativeRect, right: CreativeRect, gap = 0) {
  return left.x < right.x + right.width + gap && left.x + left.width + gap > right.x && left.y < right.y + right.height + gap && left.y + left.height + gap > right.y;
}

type CreativeLayout = { eyebrow: CreativeRect; headline: CreativeRect; subheadline: CreativeRect; product: CreativeRect; cta: CreativeRect; logo: CreativeRect; supporting?: CreativeRect; occupancy: number; issues: string[] };

export function computeCreativeLayout(spec: CreativeRenderSpec): CreativeLayout {
  const { width, height } = spec;
  const story = height / width > 1.3;
  const landscape = width / height > 1.3;
  const margin = Math.round(Math.min(width, height) * (story ? .085 : .07));
  const headlineBox = story ? { x: margin, y: 350, width: width - margin * 2, height: 280 } : landscape ? { x: margin, y: 150, width: Math.round(width * .42), height: 180 } : { x: margin, y: 255, width: width - margin * 2, height: 160 };
  const headlineFit = fitText({ text: spec.headline, maxWidth: headlineBox.width, maxHeight: headlineBox.height, maxFontSize: Math.round(Math.min(width, height) * (story ? .07 : .078)), minFontSize: 30, maxLines: story ? 4 : 3 });
  const headlineHeight = headlineFit?.rect.height ?? headlineBox.height;
  const subBox = story ? { x: margin, y: 650, width: width - margin * 2, height: 100 } : landscape ? { x: margin, y: Math.max(350, headlineBox.y + headlineHeight + 34), width: Math.round(width * .4), height: 90 } : { x: margin, y: Math.max(395, headlineBox.y + headlineHeight + 34), width: Math.round(width * .8), height: 70 };
  const product = landscape ? { x: Math.round(width * .53), y: 170, width: Math.round(width * .4), height: Math.round(height * .68) } : story ? { x: margin, y: 790, width: width - margin * 2, height: 720 } : spec.conceptDirection === "transformation" ? { x: margin, y: 700, width: width - margin * 2, height: 480 } : { x: margin, y: 490, width: width - margin * 2, height: 420 };
  const supporting = spec.conceptDirection === "transformation" ? { x: margin, y: 535, width: Math.round(width * .62), height: 125 } : spec.conceptDirection === "editorial" ? { x: margin, y: 700, width: width - margin * 2, height: 54 } : undefined;
  const cta = { x: width - margin - Math.min(Math.round(width * .24), 270), y: story ? 1690 : spec.conceptDirection === "transformation" ? 1250 : height - 125, width: Math.min(Math.round(width * .24), 270), height: Math.round(Math.min(width, height) * .055) };
  const logo = { x: margin, y: height - margin * 1.08 - Math.round(Math.min(width, height) * .065), width: Math.round(width * (story ? .31 : .2)), height: Math.round(Math.min(width, height) * .065) };
  const eyebrow = { x: margin, y: margin, width: Math.round(width * .45), height: 54 };
  const usableArea = (width - margin * 2) * (height - margin * 2);
  const occupancy = product.width * product.height / usableArea;
  const issues: string[] = [];
  if (!headlineFit) issues.push("headline_does_not_fit");
  if (intersects(headlineBox, product, 14) || intersects(subBox, product, 14)) issues.push("text_product_collision");
  if (intersects(cta, product, 14) || intersects(logo, product, 14) || intersects(cta, logo, 14)) issues.push("footer_collision");
  if (supporting && intersects(supporting, product, 14)) issues.push("supporting_visual_collision");
  if (product.width < width * .3 || product.height < height * .2) issues.push("product_proof_too_small");
  const minimum = spec.conceptDirection === "product" ? .45 : spec.conceptDirection === "transformation" ? .4 : .3;
  if (occupancy < minimum) issues.push("product_occupancy_below_threshold");
  if (headlineFit && headlineHeight > headlineBox.height) issues.push("headline_region_overflow");
  return { eyebrow, headline: { ...headlineBox, height: headlineHeight }, subheadline: subBox, product, cta, logo, supporting, occupancy, issues };
}

export function renderCreativeSvg(spec: CreativeRenderSpec) {
  const { width, height } = spec;
  const story = height / width > 1.3;
  const landscape = width / height > 1.3;
  const margin = Math.round(Math.min(width, height) * (story ? 0.085 : 0.07));
  const type = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const bg = spec.background === "paper" ? "#f3f7fd" : "#0a101b";
  const fg = spec.background === "paper" ? "#14243b" : "#eff6ff";
  const muted = spec.background === "paper" ? "#405978" : "#a9bdd5";
  const accent = "#35cafa";
  const surface = spec.background === "paper" ? "#ffffff" : "#132239";
  const layout = computeCreativeLayout(spec);
  const headlineFit = fitText({ text: spec.headline, maxWidth: layout.headline.width, maxHeight: layout.headline.height, maxFontSize: Math.round(Math.min(width, height) * (story ? .07 : .078)), minFontSize: 30, maxLines: story ? 4 : 3 });
  const subFit = fitText({ text: spec.subheadline, maxWidth: layout.subheadline.width, maxHeight: layout.subheadline.height, maxFontSize: Math.round(Math.min(width, height) * .034), minFontSize: 16, maxLines: 3 });
  const headlineSize = headlineFit?.fontSize ?? 30;
  const headlineLines = headlineFit?.lines ?? [];
  const subLines = subFit?.lines ?? [];
  const imageW = layout.product.width;
  const imageH = layout.product.height;
  const imageX = layout.product.x;
  const imageY = layout.product.y;
  const radius = Math.round(Math.min(width, height) * .026);
  const clipId = `screen-${width}-${height}`;
  const image = spec.productAssetUrl ? `<rect x="${imageX - 14}" y="${imageY - 14}" width="${imageW + 28}" height="${imageH + 28}" rx="${radius + 10}" fill="${surface}" stroke="#304762" stroke-width="2"/><image href="${escapeXml(spec.productAssetUrl)}" x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>` : "";
  const headline = headlineLines.map((line, index) => `<tspan x="${layout.headline.x}" dy="${index ? Math.round(headlineSize * 1.08) : 0}">${escapeXml(line)}</tspan>`).join("");
  const subheadline = subLines.map((line, index) => `<tspan x="${layout.subheadline.x}" dy="${index ? Math.round((subFit?.fontSize ?? 16) * 1.2) : 0}">${escapeXml(line)}</tspan>`).join("");
  const logo = spec.logoAssetUrl ? `<image href="${escapeXml(spec.logoAssetUrl)}" x="${margin}" y="${height - margin * 1.08}" width="${Math.round(width * (story ? .31 : .2))}" height="${Math.round(Math.min(width, height) * .065)}" preserveAspectRatio="xMinYMid meet"/>` : `<text x="${margin}" y="${height - margin}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .02)}" font-weight="700" fill="${fg}">TRADING DOCKS</text>`;
  const direction = spec.conceptDirection ?? "product";
  const familyLabel = direction === "transformation" ? "FROM INTAKE TO INVENTORY" : direction === "editorial" ? "A BETTER WAY TO SORT" : "PRODUCT PROOF";
  const eyebrow = `<text x="${margin}" y="${margin * 1.55}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .016)}" font-weight="700" letter-spacing="3" fill="${accent}">${escapeXml(familyLabel)}</text><text x="${margin}" y="${margin * 2.25}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .014)}" font-weight="600" letter-spacing="2.5" fill="${muted}">${escapeXml(spec.featureName.toUpperCase())}</text>`;
  const directionTreatment = direction === "transformation" ? `<rect x="${layout.supporting?.x ?? margin}" y="${layout.supporting?.y ?? 535}" width="${layout.supporting?.width ?? 560}" height="${layout.supporting?.height ?? 125}" rx="${radius}" fill="#182a42" stroke="#304762"/><text x="${margin + 28}" y="${(layout.supporting?.y ?? 535) + 48}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .018)}" font-weight="700" fill="${fg}">UNSORTED COLLECTION</text><text x="${margin + 28}" y="${(layout.supporting?.y ?? 535) + 86}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .014)}" fill="${muted}">Incoming cards, ready to identify</text><path d="M${width - margin - 120} ${(layout.supporting?.y ?? 535) + 62} h72" stroke="${accent}" stroke-width="4"/><path d="M${width - margin - 64} ${(layout.supporting?.y ?? 535) + 38} l24 24 -24 24" fill="none" stroke="${accent}" stroke-width="4"/>` : direction === "editorial" ? `<rect x="${margin}" y="${layout.supporting?.y ?? 700}" width="${layout.supporting?.width ?? width - margin * 2}" height="5" fill="${accent}"/><text x="${margin}" y="${(layout.supporting?.y ?? 700) + 36}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .014)}" font-weight="700" letter-spacing="2" fill="${muted}">BATCH PROGRESS · RECOGNIZE · CONFIRM · LOCATE</text>` : `<rect x="${margin}" y="${Math.round(height * .39)}" width="${Math.round(width * .075)}" height="5" fill="${accent}"/>`;
  const ctaY = layout.cta.y;
  const ctaW = Math.min(Math.round(width * .24), 270);
  const cta = `<rect x="${margin}" y="${ctaY}" width="${ctaW}" height="${Math.round(Math.min(width, height) * .055)}" rx="${Math.round(Math.min(width, height) * .027)}" fill="${accent}"/><text x="${margin + ctaW / 2}" y="${ctaY + Math.round(Math.min(width, height) * .036)}" text-anchor="middle" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .018)}" font-weight="700" fill="#061526">${escapeXml(spec.cta)}</text>`;
  const flow = spec.composition === "workflow" ? `<text x="${margin}" y="${Math.round(height * .4)}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .016)}" font-weight="700" letter-spacing="2" fill="${accent}">SCAN  →  IDENTIFY  →  CONFIRM  →  LOCATE</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="${clipId}"><rect x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" rx="${radius}"/></clipPath></defs><rect width="${width}" height="${height}" fill="${bg}"/>${eyebrow}<text x="${layout.headline.x}" y="${layout.headline.y}" font-family="${type}" font-size="${headlineSize}" font-weight="800" letter-spacing="-1.2" fill="${fg}">${headline}</text><text x="${layout.subheadline.x}" y="${layout.subheadline.y}" font-family="${type}" font-size="${subFit?.fontSize ?? 16}" font-weight="500" fill="${muted}">${subheadline}</text>${directionTreatment}${flow}${image}${cta}${logo}</svg>`;
}

export function validateRenderSpec(spec: CreativeRenderSpec) {
  const issues: string[] = [];
  if (!spec.headline.trim()) issues.push("missing_headline");
  if (spec.headline.length > 72) issues.push("headline_too_long");
  if (spec.subheadline.length > 150) issues.push("subheadline_too_long");
  if (!spec.cta.trim()) issues.push("missing_cta");
  if (!spec.productAssetUrl) issues.push("product_screenshot_unavailable");
  if (!spec.logoAssetUrl) issues.push("approved_logo_unavailable");
  if (/(synthetic record|synthetic demo state|no customer records|internal fixture)/i.test(`${spec.headline} ${spec.subheadline}`)) issues.push("debug_copy_visible");
  if (!["product", "transformation", "editorial"].includes(spec.conceptDirection ?? "product")) issues.push("unsupported_direction");
  if (spec.productAssetUrl) issues.push(...computeCreativeLayout(spec).issues);
  return issues;
}
