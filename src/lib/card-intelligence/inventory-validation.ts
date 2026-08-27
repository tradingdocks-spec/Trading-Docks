import { getPrinting } from "./service.ts";
import type { CardCatalogProvider, CanonicalPrinting } from "./types.ts";

export type InventoryPrintingValidationInput = { printingId: string; game: "magic" | "pokemon"; finish?: string | null; providerIds?: Record<string, string | number> };
export type CanonicalInventoryIdentity = {
  game: CanonicalPrinting["game"];
  canonicalCardId: string;
  printingId: string;
  finish: string | null;
  providerIds: Record<string, string | number>;
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  language: string | null;
  provenance: string[];
  identityAuthority: "provider_confirmed";
};
export type ValidatedInventoryPrinting = { printing: CanonicalPrinting; canonicalInventoryIdentity: CanonicalInventoryIdentity };

export async function validateInventoryPrinting(input: InventoryPrintingValidationInput, providers?: CardCatalogProvider[]): Promise<ValidatedInventoryPrinting | null> {
  if (!input.printingId.trim() || input.printingId.startsWith("synthetic:")) return null;
  const printing = await getPrinting(input.printingId, providers);
  if (!printing || printing.game !== input.game || printing.identityAuthority !== "provider_confirmed") return null;
  for (const [provider, id] of Object.entries(input.providerIds ?? {})) if (`${printing.providerIds[provider] ?? ""}` !== `${id}`) return null;
  const finish = normalizeFinish(input.finish);
  if (finish && !printing.finishes.map(normalizeFinish).includes(finish)) return null;
  return {
    printing,
    canonicalInventoryIdentity: {
      game: printing.game,
      canonicalCardId: printing.canonicalCardId,
      printingId: printing.printingId,
      finish,
      providerIds: printing.providerIds,
      name: printing.name,
      setCode: printing.setCode,
      setName: printing.setName,
      collectorNumber: printing.collectorNumber,
      language: printing.language,
      provenance: printing.provenance,
      identityAuthority: "provider_confirmed",
    },
  };
}
function normalizeFinish(value: string | null | undefined) { if (!value) return null; const normalized = value.toLowerCase().replace(/[_-]/g, " ").trim(); return normalized === "normal" || normalized === "non foil" ? "nonfoil" : normalized; }
