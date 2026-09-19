import { renderCreativeSvg, type CreativeRenderSpec } from "./creative-renderer";

export type MarketingEmailRenderInput = { subject: string; bodyText: string; previewText?: string | null; cta?: string | null; ctaUrl?: string | null; heroRenderSpec?: CreativeRenderSpec | null; fromName?: string | null; businessName?: string | null; unsubscribeUrl?: string | null; realSend?: boolean };

function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function safeHref(value: string | null | undefined) { try { const url = new URL(value ?? ""); return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.toString()) : "#"; } catch { return "#"; } }

export function renderMarketingEmail(input: MarketingEmailRenderInput) {
  const paragraphs = input.bodyText.split(/\n\s*\n/).map((part) => `<p style="margin:0 0 18px;line-height:1.65">${escapeHtml(part).replaceAll("\n", "<br />")}</p>`).join("");
  const hero = input.heroRenderSpec ? `<div>${renderCreativeSvg(input.heroRenderSpec)}</div>` : "";
  const unsubscribe = input.unsubscribeUrl ? `<a href="${safeHref(input.unsubscribeUrl)}">Unsubscribe</a>` : "Unsubscribe URL not configured";
  const cta = input.cta?.trim() ? `<a href="${safeHref(input.ctaUrl)}" style="display:inline-block;background:#0065d9;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none;font-weight:700">${escapeHtml(input.cta)}</a>` : "";
  const html = `<div style="background:#f3f7fd;padding:32px 16px;font-family:Arial,sans-serif;color:#14243b"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #c4d3e7;border-radius:16px;overflow:hidden"><div style="padding:28px 32px;border-bottom:1px solid #eaf1fb;font-weight:800;letter-spacing:2px">${escapeHtml(input.businessName || "TRADING DOCKS")}</div>${hero}<div style="padding:32px"><div style="color:#536985;font-size:12px;margin-bottom:12px">${escapeHtml(input.previewText ?? "")}</div><h1 style="font-size:24px;margin:0 0 24px">${escapeHtml(input.subject)}</h1>${paragraphs}${cta}</div><div style="padding:20px 32px;border-top:1px solid #eaf1fb;color:#536985;font-size:12px">${escapeHtml(input.fromName || "Trading Docks")} · ${unsubscribe}</div></div></div>`;
  const plainText = `${input.subject}\n\n${input.bodyText}${input.cta && input.ctaUrl ? `\n\n${input.cta}: ${input.ctaUrl}` : ""}\n\n${input.businessName || "Trading Docks"}\n${input.unsubscribeUrl ? `Unsubscribe: ${input.unsubscribeUrl}` : "Unsubscribe URL not configured"}`;
  return { html, plainText };
}
