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
  const story = height / width > 1.3;
  const landscape = width / height > 1.3;
  const margin = Math.round(Math.min(width, height) * (story ? 0.085 : 0.07));
  const type = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const bg = spec.background === "paper" ? "#f3f7fd" : "#0a101b";
  const fg = spec.background === "paper" ? "#14243b" : "#eff6ff";
  const muted = spec.background === "paper" ? "#405978" : "#a9bdd5";
  const accent = "#35cafa";
  const surface = spec.background === "paper" ? "#ffffff" : "#132239";
  const headlineSize = Math.round(Math.min(width, height) * (story ? .073 : landscape ? .083 : .078));
  const headlineLines = wrapText(spec.headline, landscape ? 25 : story ? 18 : 21);
  const subLines = wrapText(spec.subheadline, landscape ? 42 : 34);
  const bodyY = story ? Math.round(height * .27) : landscape ? Math.round(height * .2) : Math.round(height * .25);
  const subY = bodyY + Math.max(1, headlineLines.length) * Math.round(headlineSize * 1.08) + Math.round(headlineSize * .42);
  const imageW = landscape ? Math.round(width * .52) : width - margin * 2;
  const imageH = landscape ? Math.round(height * .62) : Math.round(height * (story ? .34 : .48));
  const imageX = landscape ? Math.round(width * .42) : margin;
  const imageY = landscape ? Math.round(height * .25) : Math.min(Math.round(height * (story ? .51 : .42)), subY + subLines.length * Math.round(headlineSize * .56) + Math.round(height * .04));
  const radius = Math.round(Math.min(width, height) * .026);
  const clipId = `screen-${width}-${height}`;
  const image = spec.productAssetUrl ? `<rect x="${imageX - 14}" y="${imageY - 14}" width="${imageW + 28}" height="${imageH + 28}" rx="${radius + 10}" fill="${surface}" stroke="#304762" stroke-width="2"/><image href="${escapeXml(spec.productAssetUrl)}" x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>` : "";
  const headline = headlineLines.map((line, index) => `<tspan x="${margin}" dy="${index ? Math.round(headlineSize * 1.08) : 0}">${escapeXml(line)}</tspan>`).join("");
  const subheadline = subLines.map((line, index) => `<tspan x="${margin}" dy="${index ? Math.round(headlineSize * .56) : 0}">${escapeXml(line)}</tspan>`).join("");
  const logo = spec.logoAssetUrl ? `<image href="${escapeXml(spec.logoAssetUrl)}" x="${margin}" y="${height - margin * 1.08}" width="${Math.round(width * (story ? .31 : .2))}" height="${Math.round(Math.min(width, height) * .065)}" preserveAspectRatio="xMinYMid meet"/>` : `<text x="${margin}" y="${height - margin}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .02)}" font-weight="700" fill="${fg}">TRADING DOCKS</text>`;
  const direction = spec.conceptDirection ?? "product";
  const familyLabel = direction === "transformation" ? "FROM INTAKE TO INVENTORY" : direction === "editorial" ? "A BETTER WAY TO SORT" : "PRODUCT PROOF";
  const eyebrow = `<text x="${margin}" y="${margin * 1.55}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .016)}" font-weight="700" letter-spacing="3" fill="${accent}">${escapeXml(familyLabel)}</text><text x="${margin}" y="${margin * 2.25}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .014)}" font-weight="600" letter-spacing="2.5" fill="${muted}">${escapeXml(spec.featureName.toUpperCase())}</text>`;
  const directionTreatment = direction === "transformation" ? `<rect x="${margin}" y="${Math.round(height * .35)}" width="${Math.round(width * .25)}" height="${Math.round(height * .16)}" rx="${radius}" fill="#182a42" stroke="#304762"/><text x="${margin + 28}" y="${Math.round(height * .405)}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .018)}" font-weight="700" fill="${fg}">Unsorted intake</text><text x="${margin + 28}" y="${Math.round(height * .45)}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .014)}" fill="${muted}">Cards waiting for a home</text><path d="M${Math.round(width * .3)} ${Math.round(height * .43)} H${Math.round(width * .38)}" stroke="${accent}" stroke-width="4"/><path d="M${Math.round(width * .36)} ${Math.round(height * .405)} l24 25 -24 25" fill="none" stroke="${accent}" stroke-width="4"/>` : direction === "editorial" ? `<circle cx="${Math.round(width * .88)}" cy="${Math.round(height * .17)}" r="${Math.round(Math.min(width, height) * .095)}" fill="#35cafa" opacity=".12"/><circle cx="${Math.round(width * .88)}" cy="${Math.round(height * .17)}" r="${Math.round(Math.min(width, height) * .055)}" fill="none" stroke="#35cafa" opacity=".45" stroke-width="2"/>` : `<rect x="${margin}" y="${Math.round(height * .37)}" width="${Math.round(width * .075)}" height="5" fill="${accent}"/>`;
  const ctaY = height - margin * 2.2;
  const ctaW = Math.min(Math.round(width * .24), 270);
  const cta = `<rect x="${margin}" y="${ctaY}" width="${ctaW}" height="${Math.round(Math.min(width, height) * .055)}" rx="${Math.round(Math.min(width, height) * .027)}" fill="${accent}"/><text x="${margin + ctaW / 2}" y="${ctaY + Math.round(Math.min(width, height) * .036)}" text-anchor="middle" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .018)}" font-weight="700" fill="#061526">${escapeXml(spec.cta)}</text>`;
  const flow = spec.composition === "workflow" ? `<text x="${margin}" y="${Math.round(height * .4)}" font-family="${type}" font-size="${Math.round(Math.min(width, height) * .016)}" font-weight="700" letter-spacing="2" fill="${accent}">SCAN  →  IDENTIFY  →  CONFIRM  →  LOCATE</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="${clipId}"><rect x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" rx="${radius}"/></clipPath></defs><rect width="${width}" height="${height}" fill="${bg}"/>${eyebrow}<text x="${margin}" y="${bodyY}" font-family="${type}" font-size="${headlineSize}" font-weight="800" letter-spacing="-1.2" fill="${fg}">${headline}</text><text x="${margin}" y="${subY}" font-family="${type}" font-size="${Math.round(headlineSize * .34)}" font-weight="500" fill="${muted}">${subheadline}</text>${directionTreatment}${flow}${image}${cta}${logo}</svg>`;
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
  return issues;
}
