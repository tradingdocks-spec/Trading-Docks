import { type CartLine, previewLine } from "./domain.ts";

// PostgreSQL COLLATE "C" orders UTF-8 text by Unicode code point.
function compareText(a: string, b: string) {
  const left = Array.from(a, (c) => c.codePointAt(0)!);
  const right = Array.from(b, (c) => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

/** Integer preview of the SQL calculation; the authoritative command requotes. */
export function previewCart(
  cart: CartLine[],
  taxBps: number,
  cartMinor = 0,
  cartBps = 0,
) {
  if (
    ![cartMinor, cartBps].every(Number.isSafeInteger) ||
    cartMinor < 0 ||
    cartBps < 0 ||
    cartBps > 10000 ||
    (cartMinor > 0 && cartBps > 0)
  )
    throw Error("Invalid cart discount");
  const lines = [...cart]
    .sort((a, b) => {
      const owner = compareText(
        (a.item.ownerId ?? "").toLowerCase(),
        (b.item.ownerId ?? "").toLowerCase(),
      );
      const item = compareText(a.item.id, b.item.id);
      if (owner || item) return owner || item;
      if (!a.positionId || !b.positionId)
        return a.positionId ? -1 : b.positionId ? 1 : 0;
      return compareText(a.positionId, b.positionId);
    })
    .map((line) => {
      const price = line.overrideMinor ?? line.item.unit_price_minor ?? 0;
      const value = previewLine(price, line.quantity, line.discountBps, 0);
      const fixed = line.discountMinor ?? 0;
      if (
        !Number.isSafeInteger(fixed) ||
        fixed < 0 ||
        fixed + value.discount > value.subtotal ||
        (fixed && line.discountBps)
      )
        throw Error("Invalid line discount");
      return {
        line,
        subtotal: value.subtotal,
        discount: value.discount + fixed,
        tax: 0,
        total: 0,
        cartDiscount: 0,
      };
    });
  const base = lines.reduce((n, l) => n + l.subtotal - l.discount, 0);
  const discount =
    cartMinor +
    Number((BigInt(base) * BigInt(cartBps) + BigInt(5000)) / BigInt(10000));
  if (discount > base) throw Error("Cart discount exceeds the sale");
  let cumulative = BigInt(0);
  let allocated = BigInt(0);
  for (const l of lines) {
    cumulative += BigInt(l.subtotal - l.discount);
    const next = base
      ? (BigInt(discount) * cumulative) / BigInt(base)
      : BigInt(0);
    l.cartDiscount = Number(next - allocated);
    allocated = next;
    l.discount += l.cartDiscount;
    l.tax = Number(
      (BigInt(l.subtotal - l.discount) *
        BigInt(l.line.item.taxable === false ? 0 : taxBps) +
        BigInt(5000)) /
        BigInt(10000),
    );
    l.total = l.subtotal - l.discount + l.tax;
  }
  return lines.reduce(
    (sum, l) => ({
      subtotal: sum.subtotal + l.subtotal,
      discount: sum.discount + l.discount,
      tax: sum.tax + l.tax,
      total: sum.total + l.total,
    }),
    { subtotal: 0, discount: 0, tax: 0, total: 0 },
  );
}
