export const LABEL_MEDIA = {
  dk1201: { label: "DK-1201 · 29 × 90 mm", width: 29, height: 90 },
  dk1208: { label: "DK-1208 · 38 × 90 mm", width: 38, height: 90 },
  dk1202: { label: "DK-1202 · 62 × 100 mm", width: 62, height: 100 },
  custom: { label: "Custom media", width: 29, height: 90 },
} as const;
export type LabelMediaKey = keyof typeof LABEL_MEDIA;
export type LabelPosition = "top" | "center" | "bottom";
export type ChaosSortLabelMedia = { key: LabelMediaKey; width: number; height: number; position: LabelPosition };

export function clampMediaDimension(value: string | null, fallback: number) {
  const parsed = value?.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.round(Math.min(200, Math.max(10, parsed)) * 100) / 100 : fallback;
}

export function resolveLabelMedia(params: URLSearchParams): ChaosSortLabelMedia {
  const requested = params.get("media");
  const key: LabelMediaKey = requested && Object.hasOwn(LABEL_MEDIA, requested) ? requested as LabelMediaKey : "dk1201";
  const position = params.get("position");
  return { key,
    width: key === "custom" ? clampMediaDimension(params.get("width"), 29) : LABEL_MEDIA[key].width,
    height: key === "custom" ? clampMediaDimension(params.get("height"), 90) : LABEL_MEDIA[key].height,
    position: position === "center" || position === "bottom" ? position : "top" };
}

export function chaosSortLabelPrintHref(batchId: string, media: ChaosSortLabelMedia, mode: "preview" | "print" = "print") {
  const params = new URLSearchParams({ media: media.key, position: media.position });
  if (media.key === "custom") { params.set("width", String(media.width)); params.set("height", String(media.height)); }
  params.set(mode === "preview" ? "preview" : "autoprint", "1");
  return `/dashboard/inventory/chaos-sort/labels/${encodeURIComponent(batchId)}/print?${params}`;
}
