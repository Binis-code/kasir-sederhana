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