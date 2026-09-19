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

function wrapText(value: string, maxChars: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) { lines.push(current); current = word; } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export function renderCreativeSvg(spec: CreativeRenderSpec) {
  const { width, height } = spec;
  const landscape = width / height > 1.3;
  const story = height / width > 1.3;
  const margin = Math.round(Math.min(width, height) * (story ? 0.09 : 0.075));
  const headlineSize = Math.round(Math.min(width, height) * (story ? 0.085 : landscape ? 0.085 : 0.075));
  const headlineLines = wrapText(spec.headline.toUpperCase(), landscape ? 24 : 18);
  const subLines = wrapText(spec.subheadline, landscape ? 48 : 34);
  const bg = spec.background === "paper" ? "#f3f7fd" : "#0a101b";
  const fg = spec.background === "paper" ? "#14243b" : "#eff6ff";
  const muted = spec.background === "paper" ? "#405978" : "#b9cae1";
  const accent = "#35cafa";
  const imageX = landscape ? Math.round(width * 0.49) : margin;
  const imageY = landscape ? Math.round(height * 0.17) : Math.round(height * (story ? 0.48 : spec.composition === "workflow" ? 0.49 : 0.43));
  const imageW = landscape ? Math.round(width * 0.43) : width - margin * 2;
  const imageH = landscape ? Math.round(height * 0.63) : Math.round(height * (story ? 0.34 : 0.42));
  const image = spec.productAssetUrl
    ? `<image href="${escapeXml(spec.productAssetUrl)}" x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#screenClip)"/>`
    : `<rect x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" rx="${Math.round(margin * .55)}" fill="#121e30" stroke="#304762"/><text x="${imageX + imageW / 2}" y="${imageY + imageH / 2}" text-anchor="middle" fill="#92aac7" font-family="Arial, sans-serif" font-size="${Math.round(Math.min(width, height) * .018)}">Approved product screenshot required</text>`;
  const headline = headlineLines.map((line, index) => `<tspan x="${margin}" dy="${index ? headlineSize * 1.05 : 0}">${escapeXml(line)}</tspan>`).join("");
  const subheadline = subLines.map((line, index) => `<tspan x="${margin}" dy="${index ? Math.round(headlineSize * .58) : 0}">${escapeXml(line)}</tspan>`).join("");
  const logo = spec.logoVariant === "mark" ? "TD" : "TRADING DOCKS";
  const logoMarkup = spec.logoAssetUrl ? `<image href="${escapeXml(spec.logoAssetUrl)}" x="${width - margin - Math.round(width * .19)}" y="${height - margin * 1.4}" width="${Math.round(width * .19)}" height="${Math.round(Math.min(width, height) * .055)}" preserveAspectRatio="xMaxYMid meet"/>` : `<text x="${width - margin}" y="${height - margin}" text-anchor="end" font-family="Arial, sans-serif" font-size="${Math.round(Math.min(width, height) * .018)}" font-weight="700" letter-spacing="2" fill="${fg}">${logo}</text>`;
  const flowY = Math.round(height * (landscape ? .37 : story ? .43 : .435));
  const flow = spec.composition === "workflow" ? `<g font-family="Arial, sans-serif" font-size="${Math.round(Math.min(width, height) * .018)}" font-weight="700" fill="${accent}" letter-spacing="3"><text x="${margin}" y="${flowY}">SCAN</text><text x="${Math.round(width * .31)}" y="${flowY}">→</text><text x="${Math.round(width * .39)}" y="${flowY}">IDENTIFY</text><text x="${Math.round(width * .68)}" y="${flowY}">→</text><text x="${Math.round(width * .75)}" y="${flowY}">FILE</text></g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="screenClip"><rect x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" rx="${Math.round(margin * .55)}"/></clipPath></defs><rect width="${width}" height="${height}" fill="${bg}"/><rect x="${margin}" y="${margin}" width="${Math.round(width * .075)}" height="5" fill="${accent}"/><text x="${margin}" y="${margin * 1.9}" font-family="Arial, sans-serif" font-size="${Math.round(Math.min(width, height) * .016)}" font-weight="700" letter-spacing="3" fill="${muted}">${escapeXml(spec.featureName.toUpperCase())}</text><text x="${margin}" y="${Math.round(height * (story ? .19 : landscape ? .33 : .25))}" font-family="Arial, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${fg}">${headline}</text><text x="${margin}" y="${Math.round(height * (story ? .37 : landscape ? .52 : .36))}" font-family="Arial, sans-serif" font-size="${Math.round(headlineSize * .34)}" fill="${muted}">${subheadline}</text>${flow}${image}<rect x="${margin}" y="${height - margin * 1.55}" width="${Math.min(width - margin * 2, 250)}" height="44" rx="22" fill="${accent}"/><text x="${margin + 125}" y="${height - margin * 1.55 + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#061526">${escapeXml(spec.cta)}</text>${logoMarkup}</svg>`;
}

export function validateRenderSpec(spec: CreativeRenderSpec) {
  const issues: string[] = [];
  if (!spec.headline.trim()) issues.push("missing_headline");
  if (spec.headline.length > 72) issues.push("headline_too_long");
  if (spec.subheadline.length > 150) issues.push("subheadline_too_long");
  if (!spec.cta.trim()) issues.push("missing_cta");
  if (!spec.productAssetUrl) issues.push("product_screenshot_unavailable");
  return issues;
}
