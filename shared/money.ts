export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parseRupiah(str: string): number {
  const n = Number(str.replace(/[^0-9]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function calcLineTotal(qty: number, unitPrice: number, discount: number): number {
  const base = qty * unitPrice;
  return Math.max(0, base - discount);
}

export function getTieredUnitPrice(
  basePrice: number,
  tiers: { minQty: number; unitPrice: number }[],
  qty: number
): number {
  if (!tiers || !tiers.length) return basePrice;
  const eligible = tiers
    .filter(t => qty >= t.minQty)
    .sort((a, b) => b.minQty - a.minQty);
  return eligible.length ? eligible[0].unitPrice : basePrice;
}

export function applyTransactionDiscount(
  subtotal: number,
  type: "fixed" | "percentage",
  value: number
): number {
  if (type === "fixed") return Math.min(subtotal, Math.max(0, value));
  return Math.floor(subtotal * Math.max(0, Math.min(100, value)) / 100);
}

export function applyVoucher(
  subtotal: number,
  type: "fixed" | "percentage",
  value: number,
  minPurchase: number,
  maxDiscount?: number
): { discount: number; valid: boolean; reason?: string } {
  if (subtotal < minPurchase) {
    return { discount: 0, valid: false, reason: `Minimal belanja ${formatRupiah(minPurchase)}` };
  }
  let disc = type === "fixed"
    ? Math.min(subtotal, Math.max(0, value))
    : Math.floor(subtotal * Math.max(0, Math.min(100, value)) / 100);
  if (maxDiscount !== undefined && maxDiscount > 0) {
    disc = Math.min(disc, maxDiscount);
  }
  return { discount: disc, valid: true };
}

export function ensureNonNegative(n: number): number {
  return Math.max(0, n);
}

export interface ReceiptItemPayload {
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptPayload {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  invoiceNo: string;
  dateStr: string;
  cashierName: string;
  items: ReceiptItemPayload[];
  subtotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: string;
  paidAmount: number;
  changeAmount: number;
}

export function generateWhatsAppReceiptText(p: ReceiptPayload): string {
  const lineDivider = "------------------------------";
  const itemLines = p.items.map(i =>
    `• *${i.name}*\n  ${i.qty} x ${formatRupiah(i.unitPrice)} = *${formatRupiah(i.lineTotal)}*`
  ).join("\n");

  const lines = [
    `🧾 *STRUK PEMBELIAN — ${p.storeName.toUpperCase()}*`,
    p.storeAddress ? `📍 ${p.storeAddress}` : "",
    p.storePhone ? `📞 Telp: ${p.storePhone}` : "",
    lineDivider,
    `No. Nota : *${p.invoiceNo}*`,
    `Waktu    : ${p.dateStr}`,
    `Kasir    : ${p.cashierName}`,
    lineDivider,
    itemLines,
    lineDivider,
    `Subtotal     : ${formatRupiah(p.subtotal)}`,
    p.discountTotal > 0 ? `Total Diskon : -${formatRupiah(p.discountTotal)}` : "",
    `*TOTAL AKHIR  : ${formatRupiah(p.total)}*`,
    `Metode Bayar : ${p.paymentMethod.toUpperCase()}`,
    `Nominal Bayar: ${formatRupiah(p.paidAmount)}`,
    p.changeAmount > 0 ? `Kembalian    : ${formatRupiah(p.changeAmount)}` : "",
    lineDivider,
    `_Terima kasih telah berbelanja di ${p.storeName}!_`,
  ].filter(Boolean);

  return lines.join("\n");
}

export function generateCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };
  const headerRow = headers.map(escapeCell).join(",");
  const dataRows = rows.map(row => row.map(escapeCell).join(",")).join("\n");
  return `\uFEFF${headerRow}\n${dataRows}`;
}