import { normalizeSetName } from "../tcgplayer-catalog/normalization.ts";

export type MtgSetIdentity = {
  code: string;
  name: string;
  aliases?: string[];
};

export type MtgSetIdentityMatch =
  | { status: "matched"; code: string; name: string; matchedBy: "code" | "name" | "alias" }
  | { status: "unknown"; input: string };

const SCRYFALL_SETS_URL = "https://api.scryfall.com/sets";

const FALLBACK_SET_IDENTITIES: MtgSetIdentity[] = [
  { code: "mh1", name: "Modern Horizons" },
  { code: "scd", name: "Starter Commander Decks" },
  { code: "one", name: "Phyrexia: All Will Be One", aliases: ["All Will Be One"] },
  { code: "mom", name: "March of the Machine" },
  { code: "mat", name: "March of the Machine: The Aftermath" },
  { code: "woe", name: "Wilds of Eldraine" },
  { code: "ltr", name: "The Lord of the Rings: Tales of Middle-earth" },
  { code: "ltc", name: "Tales of Middle-earth Commander" },
  { code: "clu", name: "Ravnica: Clue Edition" },
  { code: "wot", name: "Wilds of Eldraine: Enchanting Tales" },
  { code: "cmm", name: "Commander Masters", aliases: ["Commander Masters Commander"] },
  { code: "mid", name: "Innistrad: Midnight Hunt" },
  { code: "vow", name: "Innistrad: Crimson Vow" },
  { code: "neo", name: "Kamigawa: Neon Dynasty" },
  { code: "snc", name: "Streets of New Capenna" },
  { code: "dmu", name: "Dominaria United" },
  { code: "bro", name: "The Brothers' War" },
  { code: "dmr", name: "Dominaria Remastered" },
  { code: "who", name: "Doctor Who" },
  { code: "otj", name: "Outlaws of Thunder Junction" },
  { code: "otp", name: "Breaking News" },
  { code: "blb", name: "Bloomburrow" },
  { code: "dsk", name: "Duskmourn: House of Horror" },
  { code: "fdn", name: "Magic: The Gathering Foundations" },
  { code: "fin", name: "Final Fantasy" },
];

let cachedScryfallSetIdentities: MtgSetIdentity[] | null = null;

export function fallbackMtgSetIdentities() {
  return FALLBACK_SET_IDENTITIES;
}

export async function getScryfallMtgSetIdentities(fetcher: typeof fetch = fetch): Promise<MtgSetIdentity[]> {
  if (cachedScryfallSetIdentities) return cachedScryfallSetIdentities;
  try {
    const response = await fetcher(SCRYFALL_SETS_URL, {
      headers: { "User-Agent": "TradingDocks/1.0 (tradingdocks@gmail.com)" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Scryfall set metadata failed (${response.status}).`);
    const payload = await response.json() as { data?: Array<{ code?: string; name?: string; mtgo_code?: string; tcgplayer_id?: number }> };
    const remote = (payload.data ?? [])
      .filter((set): set is { code: string; name: string; mtgo_code?: string } => Boolean(set.code && set.name))
      .map((set) => ({
        code: set.code.toLowerCase(),
        name: set.name,
        aliases: set.mtgo_code && set.mtgo_code.toLowerCase() !== set.code.toLowerCase()
          ? [set.mtgo_code]
          : undefined,
      }));
    cachedScryfallSetIdentities = mergeSetIdentities(remote, FALLBACK_SET_IDENTITIES);
    return cachedScryfallSetIdentities;
  } catch {
    return FALLBACK_SET_IDENTITIES;
  }
}

export function resolveMtgSetIdentity(input: string, identities: MtgSetIdentity[] = FALLBACK_SET_IDENTITIES): MtgSetIdentityMatch {
  const value = input.trim();
  if (!value) return { status: "unknown", input: value };
  const code = normalizeSetCode(value);
  const normalizedName = normalizeSetName(value);

  for (const set of identities) {
    if (normalizeSetCode(set.code) === code) {
      return { status: "matched", code: normalizeSetCode(set.code), name: set.name, matchedBy: "code" };
    }
  }
  for (const set of identities) {
    if (normalizeSetName(set.name) === normalizedName) {
      return { status: "matched", code: normalizeSetCode(set.code), name: set.name, matchedBy: "name" };
    }
    if ((set.aliases ?? []).some((alias) => normalizeSetName(alias) === normalizedName || normalizeSetCode(alias) === code)) {
      return { status: "matched", code: normalizeSetCode(set.code), name: set.name, matchedBy: "alias" };
    }
  }

  return { status: "unknown", input: value };
}

function mergeSetIdentities(primary: MtgSetIdentity[], fallback: MtgSetIdentity[]) {
  const byCode = new Map<string, MtgSetIdentity>();
  for (const set of [...fallback, ...primary]) {
    const code = normalizeSetCode(set.code);
    const existing = byCode.get(code);
    byCode.set(code, {
      code,
      name: set.name,
      aliases: [...new Set([...(existing?.aliases ?? []), ...(set.aliases ?? [])])],
    });
  }
  return [...byCode.values()];
}

function normalizeSetCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
