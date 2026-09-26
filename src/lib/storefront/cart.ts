export const STOREFRONT_CART_VERSION = 1;
export const MAX_STOREFRONT_CART_QUANTITY = 999;

export type StorefrontCartLine = {
  publicId: string;
  storeSlug: string;
  quantity: number;
  addedAt: string;
};

export type StorefrontCart = {
  version: typeof STOREFRONT_CART_VERSION;
  lines: StorefrontCartLine[];
};

export type CartValidation = {
  listingPrice: number | null;
  availableQuantity: number;
  name: string;
  setName: string | null;
  collectorNumber: string | null;
  condition: string | null;
  finish: string | null;
  language: string | null;
  imageUrl: string | null;
  priceVisible: boolean;
  quantityVisible: boolean;
  isAvailable: boolean;
};

export function cartStorageKey(storeSlug: string) {
  return `td:storefront:cart:v${STOREFRONT_CART_VERSION}:${storeSlug}`;
}

export function parseStorefrontCart(raw: string | null, storeSlug: string): StorefrontCart {
  if (!raw) return { version: STOREFRONT_CART_VERSION, lines: [] };
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; lines?: unknown };
    if (parsed.version !== STOREFRONT_CART_VERSION || !Array.isArray(parsed.lines)) {
      return { version: STOREFRONT_CART_VERSION, lines: [] };
    }
    const lines = parsed.lines.flatMap((candidate): StorefrontCartLine[] => {
      if (!candidate || typeof candidate !== "object") return [];
      const value = candidate as Record<string, unknown>;
      if (value.storeSlug !== storeSlug || typeof value.publicId !== "string" || !value.publicId) return [];
      if (!Number.isInteger(value.quantity) || Number(value.quantity) < 1 || Number(value.quantity) > MAX_STOREFRONT_CART_QUANTITY) return [];
      return [{
        publicId: value.publicId,
        storeSlug,
        quantity: Number(value.quantity),
        addedAt: typeof value.addedAt === "string" ? value.addedAt : new Date(0).toISOString(),
      }];
    });
    return { version: STOREFRONT_CART_VERSION, lines: mergeCartLines(lines) };
  } catch {
    return { version: STOREFRONT_CART_VERSION, lines: [] };
  }
}

export function mergeCartLines(lines: StorefrontCartLine[]) {
  const merged = new Map<string, StorefrontCartLine>();
  for (const line of lines) {
    const key = cartLineKey(line);
    const current = merged.get(key);
    merged.set(key, {
      ...line,
      quantity: Math.min(MAX_STOREFRONT_CART_QUANTITY, (current?.quantity ?? 0) + line.quantity),
      addedAt: current?.addedAt ?? line.addedAt,
    });
  }
  return [...merged.values()];
}

export function cartLineKey(line: Pick<StorefrontCartLine, "publicId" | "storeSlug">) {
  return `${line.storeSlug}:${line.publicId}`;
}

export function addCartLine(cart: StorefrontCart, publicId: string, storeSlug: string, available: number, now = new Date().toISOString()): StorefrontCart {
  if (!publicId || !storeSlug || !Number.isInteger(available) || available < 1) return cart;
  const key = cartLineKey({ publicId, storeSlug });
  const found = cart.lines.find((line) => cartLineKey(line) === key);
  if (found && found.quantity >= available) return cart;
  const requested = (found?.quantity ?? 0) + 1;
  const nextLine: StorefrontCartLine = {
    publicId, storeSlug, quantity: Math.min(requested, available, MAX_STOREFRONT_CART_QUANTITY),
    addedAt: found?.addedAt ?? now,
  };
  return { version: STOREFRONT_CART_VERSION, lines: [...cart.lines.filter((line) => cartLineKey(line) !== key), nextLine] };
}

export function setCartQuantity(cart: StorefrontCart, publicId: string, quantity: number): StorefrontCart {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_STOREFRONT_CART_QUANTITY) {
    return cart;
  }
  return {
    version: STOREFRONT_CART_VERSION,
    lines: cart.lines.map((line) => line.publicId === publicId ? { ...line, quantity } : line),
  };
}

export function removeCartLine(cart: StorefrontCart, publicId: string): StorefrontCart {
  return { version: STOREFRONT_CART_VERSION, lines: cart.lines.filter((line) => line.publicId !== publicId) };
}

export function validateCartSubtotal(lines: StorefrontCartLine[], current: Map<string, CartValidation>) {
  return lines.reduce((total, line) => {
    const item = current.get(cartLineKey(line));
    if (!item?.isAvailable || item.listingPrice === null || !Number.isFinite(item.listingPrice)) return total;
    return total + item.listingPrice * line.quantity;
  }, 0);
}
