import { describe, it, expect } from "vitest";
import {
  formatRupiah,
  parseRupiah,
  calcLineTotal,
  applyTransactionDiscount,
  applyVoucher,
  ensureNonNegative,
} from "../shared/money.js";

describe("formatRupiah", () => {
  it("memformat integer rupiah gaya Indonesia", () => {
    expect(formatRupiah(15000)).toBe("Rp\u00A015.000");
    expect(formatRupiah(0)).toContain("0");
  });
});

describe("parseRupiah", () => {
  it("mengekstrak angka dari input bebas", () => {
    expect(parseRupiah("Rp 12.500")).toBe(12500);
    expect(parseRupiah("abc")).toBe(0);
  });
});

describe("calcLineTotal", () => {
  it("qty × harga − diskon", () => {
    expect(calcLineTotal(3, 5000, 2000)).toBe(13000);
  });
  it("tidak pernah negatif", () => {
    expect(calcLineTotal(1, 5000, 99999)).toBe(0);
  });
});

describe("applyTransactionDiscount", () => {
  it("fixed dibatasi subtotal", () => {
    expect(applyTransactionDiscount(10000, "fixed", 3000)).toBe(3000);
    expect(applyTransactionDiscount(10000, "fixed", 99999)).toBe(10000);
    expect(applyTransactionDiscount(10000, "fixed", -5)).toBe(0);
  });
  it("percentage dibatasi 0–100 dan dibulatkan ke bawah", () => {
    expect(applyTransactionDiscount(9999, "percentage", 10)).toBe(999);
    expect(applyTransactionDiscount(10000, "percentage", 150)).toBe(10000);
  });
});

describe("applyVoucher", () => {
  const base = { type: "fixed" as const, value: 5000, maxDiscount: undefined };
  it("menolak di bawah minimum belanja", () => {
    const r = applyVoucher(20000, base.type, base.value, 30000);
    expect(r.valid).toBe(false);
    expect(r.discount).toBe(0);
  });
  it("fixed memberikan diskon penuh", () => {
    const r = applyVoucher(50000, base.type, 5000, 30000);
    expect(r.valid).toBe(true);
    expect(r.discount).toBe(5000);
  });
  it("percentage di-clamp maxDiscount", () => {
    const r = applyVoucher(200000, "percentage", 50, 0, 15000);
    expect(r.discount).toBe(15000);
  });
  it("diskon voucher tidak melebihi subtotal", () => {
    const r = applyVoucher(4000, "fixed", 5000, 0);
    expect(r.discount).toBe(4000);
  });
});

describe("ensureNonNegative", () => {
  it("total akhir tidak boleh negatif", () => {
    expect(ensureNonNegative(-1)).toBe(0);
    expect(ensureNonNegative(42)).toBe(42);
  });
});
