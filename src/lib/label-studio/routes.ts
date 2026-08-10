export const LABEL_STUDIO_ROUTE = "/dashboard/label-studio" as const;

export type LabelStudioEntrySource =
  | "inventory"
  | "card-shows"
  | "sealed-inventory"
  | "pos";

export type LabelStudioEntryMode =
  | "print-labels"
  | "show-labels"
  | "reprint-label";

export function labelStudioHref(
  source?: LabelStudioEntrySource,
  mode?: LabelStudioEntryMode,
  ids?: string[],
) {
  if (!source && !mode && !ids?.length) return LABEL_STUDIO_ROUTE;
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (mode) params.set("mode", mode);
  if (ids?.length) {
    const bounded = [...new Set(ids)]
      .filter((id) => /^[A-Za-z0-9_-]{1,80}$/.test(id))
      .slice(0, 50);
    if (bounded.length) params.set("ids", bounded.join(","));
  }
  return `${LABEL_STUDIO_ROUTE}?${params.toString()}`;
}
