const SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;
const MAX_SHARED_CARDS = 2500;
const MAX_TEXT_LENGTH = 500;

export type SafeSharedCard = {
  name: string;
  imageUrl: string | null;
  value: number | null;
  quantity: number;
  set: string | null;
  condition: string | null;
  finish: string | null;
  page: number | null;
  slot: string | null;
  tradeStatus: string | null;
};

export function isValidShareToken(token: string) {
  return SHARE_TOKEN_PATTERN.test(token);
}

export function safeText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength)
    : "";
}

export function safeNullableText(value: unknown, maxLength = 120) {
  const text = safeText(value, maxLength);
  return text || null;
}

export function safeFiniteNumber(
  value: unknown,
  fallback = 0,
  min = 0,
  max = 100_000_000,
) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function safePositiveInteger(value: unknown, fallback = 1, max = 100_000) {
  return Math.round(safeFiniteNumber(value, fallback, 0, max));
}

export function safeImageUrl(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      (
        url.hostname === "cards.scryfall.io" ||
        url.hostname === "api.scryfall.com" ||
        url.hostname.endsWith(".supabase.co")
      )
    ) {
      return url.toString().slice(0, 1500);
    }
  } catch {
    return null;
  }

  return null;
}

export function sanitizeSharedCard(value: unknown): SafeSharedCard | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const card = value as Record<string, unknown>;
  const name = safeText(card.name, 180);
  if (!name) return null;

  const permittedTradeStatuses = new Set([
    "available",
    "reserved",
    "pending",
    "not_for_trade",
    "looking_for_upgrade",
    "for_sale",
  ]);
  const requestedTradeStatus = safeText(card.tradeStatus, 40);

  return {
    name,
    imageUrl: safeImageUrl(card.imageUrl),
    value: card.value === null || card.value === undefined
      ? null
      : safeFiniteNumber(card.value, 0, 0, 10_000_000),
    quantity: safePositiveInteger(card.quantity, 1, 10_000),
    set: safeNullableText(card.set, 100),
    condition: safeNullableText(card.condition, 40),
    finish: safeNullableText(card.finish, 60),
    page: card.page === null || card.page === undefined
      ? null
      : safePositiveInteger(card.page, 1, 10_000),
    slot: safeNullableText(card.slot, 20),
    tradeStatus: permittedTradeStatuses.has(requestedTradeStatus)
      ? requestedTradeStatus
      : null,
  };
}

export function sanitizeSharedCards(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_SHARED_CARDS)
    .map(sanitizeSharedCard)
    .filter((card): card is SafeSharedCard => Boolean(card));
}

export function sanitizeLegacyBinderPayload(value: unknown) {
  const payload =
    value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};

  const cards = sanitizeSharedCards(payload.cards);

  return {
    totalValue: safeFiniteNumber(payload.totalValue, 0, 0, 100_000_000),
    totalCards: safePositiveInteger(
      payload.totalCards,
      cards.reduce((sum, card) => sum + card.quantity, 0),
      1_000_000,
    ),
    occupied: safePositiveInteger(payload.occupied, cards.length, 100_000),
    cards,
  };
}

export function shareHasExpired(expiresAt: unknown) {
  if (!expiresAt) return false;
  const timestamp = new Date(String(expiresAt)).getTime();
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

export function buildAccountReturnPath(pathname: string, intent: string) {
  const next = encodeURIComponent(pathname);
  const safeIntent = encodeURIComponent(safeText(intent, 40) || "view-share");
  return `/sign-up?next=${next}&intent=${safeIntent}`;
}
