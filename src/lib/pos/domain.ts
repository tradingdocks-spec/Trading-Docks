export type PosItem = {
  ownerId?: string;
  positionId?: string | null; barcodeIdentity?: string; targetType?: string;
  id: string; name: string; sku: string; set_code: string | null;
  collector_number: string | null; condition: string | null; finish: string | null;
  language: string | null; location_id: string; location: string;
  unit_price_minor: number | null; available: number; taxable: boolean;
  positions: { id: string; batchId: string; quantity: number; locationId: string }[];
};
export type CartLine = { item: PosItem; quantity: number; discountBps: number; positionId?: string; discountMinor?: number; overrideMinor?: number };
export type ReceiptLine = {
  itemId: string; name: string; sku: string; quantity: number; unitPriceMinor: number;
  discountMinor: number; taxMinor: number; lineTotalMinor: number;
  setCode: string | null; collectorNumber: string | null; condition: string | null;
  finish: string | null; language: string | null; locationId: string;
};
export type Receipt = {
  timezone?: string; employeeName?: string; settings?: { receiptWidth?: string; address?: string; footer?: string; returnPolicy?: string; showEmployee?: boolean; showSku?: boolean; showLocation?: boolean };
  version: number; number: string; site: string; register: string; actorId: string;
  createdAt: string; currency: string; lines: ReceiptLine[]; subtotalMinor: number;
  discountMinor: number; taxMinor: number; totalMinor: number; cashMinor: number; changeMinor: number;
};
export type Bootstrap = {
  operatorName?: string;
  operators?: { id: string; name: string }[];
  sites: { id: string; name: string; tax_bps: number; timezone?: string; settings?: Record<string, unknown> }[];
  registers: { id: string; site_id: string; name: string; active?: boolean }[];
  sessions: { id: string; register_id: string; site_id: string; status?: string }[];
  locations: { id: string; name: string }[];
  canManage: boolean;
};
export function money(minor: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
}
export function parseMinor(input: string): number | null {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(input.trim())) return null;
  const [whole, fraction = ''] = input.trim().split('.');
  return Number(BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0')));
}
export function previewLine(unitPriceMinor: number, quantity: number, discountBps: number, taxBps: number) {
  for (const n of [unitPriceMinor, quantity, discountBps, taxBps]) {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid amount');
  }
  if (unitPriceMinor > 100000000 || quantity < 1 || quantity > 1000 || discountBps > 10000 || taxBps > 2500) throw new Error('Invalid amount');
  const subtotal = BigInt(unitPriceMinor) * BigInt(quantity);
  const discount = (subtotal * BigInt(discountBps) + BigInt(5000)) / BigInt(10000);
  const tax = ((subtotal - discount) * BigInt(taxBps) + BigInt(5000)) / BigInt(10000);
  return { subtotal: Number(subtotal), discount: Number(discount), tax: Number(tax), total: Number(subtotal - discount + tax) };
}
export function addScan(lines: CartLine[], item: PosItem): CartLine[] {
  if (item.unit_price_minor === null) throw new Error('Set an asking price in inventory before selling this item.');
  const current = lines.find(line => line.item.id === item.id && line.item.ownerId === item.ownerId && (line.positionId ?? '') === (item.positionId ?? ''));
  if ((current?.quantity ?? 0) + 1 > Math.min(item.available, 1000)) throw new Error('No more available copies.');
  return current ? lines.map(line => line === current ? { ...line, item, quantity: line.quantity + 1 } : line)
    : [...lines, { item, quantity: 1, discountBps: 0, ...(item.positionId ? { positionId: item.positionId } : {}) }];
}
export const POS_ERRORS: Record<string, string> = {
  POS_APPROVAL_REQUIRED: 'This action needs approval from an independently signed-in manager.',
  POS_REASON_REQUIRED: 'Enter a reason for the cash variance.',
  POS_REFUND_EXCEEDED: 'The refund quantity exceeds the remaining quantity on this sale.',
  POS_BARCODE_AMBIGUOUS: 'Barcode mapping needs attention. A manager must review the mapping before this barcode can be sold.',
  POS_BARCODE_INACTIVE: 'This label references inventory that is no longer active or available at this location. Search inventory for a replacement.',
  POS_BARCODE_WRONG_CLASS: 'This barcode identifies storage or intake, not a sellable item.',
  POS_RATE_LIMIT: 'Too many POS requests. Wait a moment and retry the same checkout.',
  POS_CHECKOUT_CANCELED: 'This checkout was canceled. Start a new sale after checking any cash taken.',
  POS_DISABLED: 'POS is not enabled for this workspace yet.',
  POS_FORBIDDEN: 'You do not have permission to perform this operation on inventory at this location. Check staff permissions and owner-granted access.',
  POS_INVALID: 'Check the checkout details and try again.',
  POS_STOCK_UNAVAILABLE: 'An item is no longer available. Refresh inventory and review the cart.',
  POS_PROVENANCE_CONFLICT: 'Inventory locations or batch counts need review before this item can be sold.',
  POS_QUOTE_CHANGED: 'Prices or tax changed. Refresh the cart and confirm the new total.',
  POS_PRICE_REQUIRED: 'Set an asking price in inventory before selling this item.',
  POS_CASH_INSUFFICIENT: 'Cash received must cover the total.',
  POS_SESSION_CLOSED: 'Open this register before checkout.',
  POS_REGISTER_BUSY: 'This register is already open with another operator.',
  POS_IDEMPOTENCY_CONFLICT: 'This checkout reference already belongs to another request. Check transaction history.',
  POS_DISCOUNT_REASON: 'Enter a reason for the discount.',
};
