import { TCGTRACKING_POKEMON_GAME_ID, createTcgTrackingClient, type TcgTrackingClient } from "../providers/tcgtracking/client.ts";
import { searchTcgProducts } from "../providers/tcgtracking/product-search.ts";
import type { CanonicalPrinting, CardCatalogProvider, CardRecognitionSignals } from "./types.ts";

export class TcgTrackingCatalogProvider implements CardCatalogProvider {
  readonly id = "tcgtracking";
  private readonly client: Pick<TcgTrackingClient, "product" | "sets" | "cards">;
  constructor(client: Pick<TcgTrackingClient, "product" | "sets" | "cards"> = createTcgTrackingClient()) { this.client = client; }

  async search(signals: CardRecognitionSignals, options: { limit?: number } = {}): Promise<CanonicalPrinting[]> {
    if (signals.game !== "pokemon") return [];
    const query = [signals.cardName ?? signals.ocrText, signals.setCode ?? signals.setName, signals.collectorNumber].filter(Boolean).join(" ");
    if (!query.trim()) return [];
    const products = await searchTcgProducts({ gameId: TCGTRACKING_POKEMON_GAME_ID, query, limit: options.limit ?? 10, client: this.client });
    return products.map(toPrinting);
  }

  async printing(id: string): Promise<CanonicalPrinting | null> {
    const parsed = parsePrintingId(id);
    if (!parsed) return null;
    if (parsed.provider === "tcgtracking") {
      const product = await this.client.product(parsed.id).catch(() => null);
      return product && product.categoryId === "3" ? toPrinting({ ...product, variants: product.finishes, tcgplayerProductId: product.tcgplayerProductId ?? null }) : null;
    }
    const matches = await searchTcgProducts({ gameId: TCGTRACKING_POKEMON_GAME_ID, query: parsed.id, limit: 10, client: this.client });
    const product = matches.find((entry) => `${entry.tcgplayerProductId}` === parsed.id);
    return product ? toPrinting(product) : null;
  }
}

function toPrinting(product: { providerProductId: string; tcgplayerProductId: number | null; name: string; cleanName?: string; setName?: string; setCode?: string; collectorNumber?: string; rarity?: string; imageUrl?: string; variants: string[] }): CanonicalPrinting {
  const providerKey = product.tcgplayerProductId ? `tcgplayer:${product.tcgplayerProductId}` : `tcgtracking:${product.providerProductId}`;
  return {
      canonicalCardId: `pokemon-product:${providerKey}`,
      printingId: product.tcgplayerProductId ? `tcgplayer:${product.tcgplayerProductId}` : `tcgtracking:${product.providerProductId}`,
      game: "pokemon",
      name: product.name,
      setName: product.setName ?? null,
      setCode: product.setCode ?? null,
      collectorNumber: product.collectorNumber ?? null,
      language: null,
      finishes: product.variants,
      rarity: product.rarity ?? null,
      imageUrl: product.imageUrl ?? null,
      providerIds: Object.fromEntries(Object.entries({ tcgtracking: product.providerProductId, tcgplayer: product.tcgplayerProductId }).filter((entry): entry is [string, string | number] => entry[1] !== null)),
      provenance: ["tcgtracking", ...(product.tcgplayerProductId ? ["tcgplayer"] : [])],
      identityAuthority: "provider_confirmed",
      prices: [],
    };
}

function parsePrintingId(value: string) { const match = value.match(/^(tcgtracking|tcgplayer):(.+)$/); return match ? { provider: match[1], id: match[2] } : null; }
