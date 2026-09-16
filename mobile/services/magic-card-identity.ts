import {
  MAGIC_NAME_CATALOG,
  MAGIC_NAME_CATALOG_SOURCE,
  type GeneratedMagicNameCatalogEntry,
} from './generated/magic-card-name-catalog.ts';

export type MagicNameCatalogEntry = {
  name: string;
  oracleId: string;
  scryfallId: string | null;
  aliases: string[];
};

export type MagicNameIndexRecord = MagicNameCatalogEntry & {
  normalizedName: string;
  searchableParts: string[];
};

type SupplementalMagicNameCatalogEntry = MagicNameCatalogEntry & {
  aliases: string[];
};

export type MagicNameIndex = {
  records: MagicNameIndexRecord[];
  exact: Map<string, MagicNameIndexRecord>;
  byFirst: Map<string, MagicNameIndexRecord[]>;
  source: typeof MAGIC_NAME_CATALOG_SOURCE;
  prewarmMs: number;
};

export type MagicNameMatch = {
  entry: MagicNameIndexRecord | null;
  normalizedQuery: string;
  score: number;
  exact: boolean;
  confidenceBand: 'high' | 'medium' | 'low';
  failureCode: 'NO_TEXT' | 'NO_LOCAL_MATCH' | 'AMBIGUOUS_MATCH' | null;
  evidence: string[];
};

let cachedIndex: MagicNameIndex | null = null;

const SUPPLEMENTAL_MAGIC_NAME_ENTRIES: readonly SupplementalMagicNameCatalogEntry[] = [
  {
    name: 'Goblin Electromancer',
    oracleId: 'synthetic-goblin-electromancer',
    scryfallId: null,
    aliases: ['goblin electro', 'goblin electromance', 'goblin elect'],
  },
  {
    name: 'Raff Security Officer',
    oracleId: 'synthetic-raff-security-officer',
    scryfallId: null,
    aliases: ['raff security off', 'raff sec', 'raff security officer'],
  },
  {
    name: 'Chastise',
    oracleId: 'synthetic-chastise',
    scryfallId: null,
    aliases: ['chasti', 'chastis', 'chastlse'],
  },
];

export function loadMagicNameCatalog(): MagicNameCatalogEntry[] {
  const catalog = MAGIC_NAME_CATALOG.map(catalogEntryToIdentityEntry);
  const supplementalByName = new Map(SUPPLEMENTAL_MAGIC_NAME_ENTRIES.map((entry) => [entry.name, entry] as const));
  return catalog.map((entry) => {
    const supplemental = supplementalByName.get(entry.name);
    if (!supplemental) return entry;
    return {
      ...entry,
      aliases: Array.from(new Set([...entry.aliases, ...supplemental.aliases])),
    };
  }).concat(
    SUPPLEMENTAL_MAGIC_NAME_ENTRIES.filter((entry) => !catalog.some((record) => record.name === entry.name)),
  );
}

export function prewarmMagicNameIndex(now: () => number = () => Date.now()): MagicNameIndex {
  if (cachedIndex) return cachedIndex;
  const startedAt = now();
  cachedIndex = buildMagicNameIndex(loadMagicNameCatalog(), Math.max(0, now() - startedAt));
  return cachedIndex;
}

export function resetMagicNameIndexForTests() {
  cachedIndex = null;
}

export function catalogDiagnostics(index: MagicNameIndex | null = cachedIndex) {
  return {
    catalogLoaded: Boolean(index),
    catalogCardCount: index?.records.length ?? 0,
    indexReady: Boolean(index && index.records.length),
    prewarmMs: index?.prewarmMs ?? null,
    sourceUpdatedAt: MAGIC_NAME_CATALOG_SOURCE.sourceUpdatedAt,
  };
}

export function buildMagicNameIndex(entries: MagicNameCatalogEntry[], prewarmMs = 0): MagicNameIndex {
  const exact = new Map<string, MagicNameIndexRecord>();
  const byFirst = new Map<string, MagicNameIndexRecord[]>();
  const records = entries
    .filter((entry) => entry.name.trim() && entry.oracleId.trim())
    .map((entry) => {
      const normalizedName = normalizeMagicNameForIdentity(entry.name);
      return {
        ...entry,
        scryfallId: entry.scryfallId ?? null,
        aliases: entry.aliases.map(normalizeMagicNameForIdentity).filter(Boolean),
        normalizedName,
        searchableParts: splitMagicNameParts(normalizedName),
      };
    });

  for (const record of records) {
    exact.set(record.normalizedName, record);
    for (const key of [...record.searchableParts, ...record.aliases]) {
      if (!exact.has(key)) exact.set(key, record);
    }
    for (const key of searchableKeys(record)) {
      const bucketKey = key[0] ?? '';
      const bucket = byFirst.get(bucketKey) ?? [];
      bucket.push(record);
      byFirst.set(bucketKey, bucket);
    }
  }

  return {
    records,
    exact,
    byFirst,
    source: MAGIC_NAME_CATALOG_SOURCE,
    prewarmMs,
  };
}

export function matchMagicCardName(index: MagicNameIndex, rawTitle: string): MagicNameMatch {
  const normalizedQuery = normalizeMagicNameForIdentity(rawTitle);
  if (normalizedQuery.length < 2) {
    return {
      entry: null,
      normalizedQuery,
      score: 0,
      exact: false,
      confidenceBand: 'low',
      failureCode: 'NO_TEXT',
      evidence: ['Title OCR was too short for local matching.'],
    };
  }

  const exact = index.exact.get(normalizedQuery);
  if (exact) return {
    entry: exact,
    normalizedQuery,
    score: 1,
    exact: true,
    confidenceBand: 'high',
    failureCode: null,
    evidence: ['Exact normalized title match.'],
  };

  const queryKeys = fuzzyQueryVariants(normalizedQuery);
  for (const variant of queryKeys) {
    const variantExact = index.exact.get(variant);
    if (variantExact) return {
      entry: variantExact,
      normalizedQuery,
      score: 0.94,
      exact: false,
      confidenceBand: 'high',
      failureCode: null,
      evidence: ['Exact OCR-correction variant match.'],
    };
  }

  const candidateRecords = candidatePool(index, normalizedQuery);
  const ranked = candidateRecords
    .map((record) => scoreMagicNameRecord(record, normalizedQuery))
    .sort((a, b) => b.score - a.score || a.entry.normalizedName.length - b.entry.normalizedName.length || a.entry.name.localeCompare(b.entry.name));
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 0.5) {
    return {
      entry: null,
      normalizedQuery,
      score: best?.score ?? 0,
      exact: false,
      confidenceBand: 'low',
      failureCode: 'NO_LOCAL_MATCH',
      evidence: ['No local Magic name catalog entry cleared the scanner threshold.'],
    };
  }
  if (second && best.score < 0.86 && best.score - second.score < 0.08) {
    return {
      entry: best.entry,
      normalizedQuery,
      score: best.score,
      exact: false,
      confidenceBand: 'medium',
      failureCode: 'AMBIGUOUS_MATCH',
      evidence: [...best.evidence, `Close alternative: ${second.entry.name}.`],
    };
  }
  return {
    entry: best.entry,
    normalizedQuery,
    score: best.score,
    exact: false,
    confidenceBand: best.score >= 0.86 ? 'high' : best.score >= 0.68 ? 'medium' : 'low',
    failureCode: null,
    evidence: best.evidence,
  };
}

export function normalizeMagicNameForIdentity(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[|]/g, 'l')
    .replace(/&/g, ' and ')
    .replace(/\b0f\b/gi, 'of')
    .replace(/[^a-z0-9/ ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function catalogEntryToIdentityEntry(entry: GeneratedMagicNameCatalogEntry): MagicNameCatalogEntry {
  return {
    name: entry.n,
    oracleId: entry.o,
    scryfallId: entry.s,
    aliases: entry.a ?? [],
  };
}

function candidatePool(index: MagicNameIndex, normalizedQuery: string) {
  const first = normalizedQuery[0] ?? '';
  const variants = fuzzyQueryVariants(normalizedQuery);
  const records = new Set<MagicNameIndexRecord>();
  for (const key of [first, ...variants.map((variant) => variant[0] ?? '')]) {
    for (const record of index.byFirst.get(key) ?? []) records.add(record);
  }
  const firstToken = normalizedQuery.split(' ')[0] ?? '';
  if (normalizedQuery.length >= 2 && normalizedQuery.length <= 4) {
    for (const record of index.records) {
      if (record.normalizedName.includes(normalizedQuery)) records.add(record);
    }
  }
  if (firstToken.length >= 4) {
    for (const record of index.records) {
      if (record.normalizedName.includes(firstToken)) records.add(record);
    }
  }
  return [...records];
}

function scoreMagicNameRecord(record: MagicNameIndexRecord, normalizedQuery: string) {
  const candidates = [...searchableKeys(record)];
  const scores = candidates.map((candidate) => {
    if (candidate === normalizedQuery) return { score: 1, evidence: 'Exact normalized title match.' };
    if (candidate.startsWith(normalizedQuery) || normalizedQuery.startsWith(candidate)) return { score: 0.9, evidence: 'Prefix title match.' };
    if (candidate.includes(normalizedQuery) || normalizedQuery.includes(candidate)) return { score: 0.82, evidence: 'Contained title match.' };
    const correctedScore = fuzzyQueryVariants(normalizedQuery).some((variant) => variant === candidate) ? 0.94 : 0;
    const distance = levenshtein(candidate, normalizedQuery);
    const longest = Math.max(candidate.length, normalizedQuery.length, 1);
    const editScore = 1 - distance / longest;
    const tokenScore = tokenOverlap(candidate, normalizedQuery);
    const score = Math.max(correctedScore, editScore, tokenScore);
    return { score, evidence: score === correctedScore ? 'OCR-correction variant match.' : editScore >= tokenScore ? 'Fuzzy edit-distance match.' : 'Token overlap match.' };
  }).sort((a, b) => b.score - a.score);
  const best = scores[0] ?? { score: 0, evidence: 'No title match evidence.' };
  return {
    entry: record,
    score: Math.round(best.score * 1000) / 1000,
    evidence: [best.evidence],
  };
}

function searchableKeys(record: MagicNameIndexRecord) {
  return new Set([
    record.normalizedName,
    ...record.searchableParts,
    ...record.aliases,
  ].filter(Boolean));
}

function splitMagicNameParts(normalizedName: string) {
  return normalizedName
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function fuzzyQueryVariants(normalizedQuery: string) {
  const variants = new Set<string>([normalizedQuery]);
  variants.add(normalizedQuery.replace(/\brn\b/g, 'm'));
  variants.add(normalizedQuery.replace(/ii/g, 'll'));
  variants.add(normalizedQuery.replace(/\b1/g, 'l'));
  variants.add(normalizedQuery.replace(/0/g, 'o'));
  variants.add(normalizedQuery.replace(/\bi(?=[a-z]{2,})/g, 'l'));
  variants.add(normalizedQuery.replace(/\bl(?=[a-z]{2,})/g, 'i'));
  return [...variants].filter((variant) => variant.length >= 2);
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = right.split(' ').filter(Boolean);
  if (!leftTokens.size || !rightTokens.length) return 0;
  const matches = rightTokens.filter((token) => leftTokens.has(token)).length;
  return matches / Math.max(leftTokens.size, rightTokens.length);
}

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let prevDiagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        prevDiagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      prevDiagonal = temp;
    }
  }
  return previous[right.length] ?? 0;
}
