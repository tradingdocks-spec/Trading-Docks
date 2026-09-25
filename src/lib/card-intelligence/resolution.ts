/** Physical observations are separate from catalog identity and ranking scores. */
export type ResolutionState = "CONFIRMED" | "PROBABLE" | "REVIEW_REQUIRED" | "UNRESOLVED";

export function knownAttribute(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  return !text || ["unknown", "unrecorded", "unresolved", "n/a"].includes(text) ? null : text;
}

export function physicalFinish(value: unknown): string | null {
  const text = knownAttribute(value)?.replace(/[_-]/g, " ");
  if (text === "normal" || text === "non foil" || text === "nonfoil") return "nonfoil";
  return text === "foil" || text === "etched" ? text : null;
}

export function physicalLanguage(value: unknown): string | null {
  const text = knownAttribute(value);
  return text === "english" ? "en" : text;
}

export function physicalResolution(input: {
  exactPrinting: boolean;
  candidateCount?: number;
  finish?: unknown;
  language?: unknown;
  condition?: unknown;
  conflicts?: string[];
  variantAmbiguous?: boolean;
}): { state: ResolutionState; reasons: string[]; canFinalize: boolean } {
  const reasons = [...(input.conflicts ?? [])];
  if (!input.exactPrinting) reasons.push("Exact printing unresolved");
  if ((input.candidateCount ?? 1) > 1) reasons.push("Multiple possible printings");
  if (!physicalFinish(input.finish)) reasons.push("Physical finish requires confirmation");
  if (!physicalLanguage(input.language)) reasons.push("Physical language requires confirmation");
  if (!knownAttribute(input.condition)) reasons.push("Physical condition requires confirmation");
  if (input.variantAmbiguous) reasons.push("Variant requires confirmation");
  const state: ResolutionState = reasons.length ? (input.candidateCount === 0 ? "UNRESOLVED" : "REVIEW_REQUIRED") : "CONFIRMED";
  return { state, reasons, canFinalize: state === "CONFIRMED" };
}
