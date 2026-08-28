import { router, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import {
  sales,
  saleItems,
  salePayments,
  productVariants,
  products,
  receivables,
  inventoryMovements,
  vouchers,
  searchFrequency,
  invoiceCounters,
  heldCarts,
  priceTiers,
} from "../../drizzle/schema.js";
import { eq, sql, and, desc, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { calcLineTotal, applyTransactionDiscount, applyVoucher, getTieredUnitPrice } from "../../shared/money.js";

const checkoutSchema = z.object({
  items: z.array(z.object({
    variantId: z.number().int().positive(),
    qty: z.number().int().min(1),
    discount: z.number().int().min(0).default(0),
    unitPrice: z.number().int().min(0).optional(),
  })).min(1, "Keranjang kosong"),
  trxDiscountType: z.enum(["fixed", "percentage"]).optional().nullable(),
  trxDiscountValue: z.number().int().min(0).default(0),
  voucherCode: z.string().max(64).optional().nullable(),
  paymentMethod: z.enum(["cash", "qris", "debit", "kredit"]),
  paidAmount: z.number().int().min(0),
  referenceNo: z.string().max(64).optional().nullable(),
  customerName: z.string().max(128).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  heldCartId: z.number().int().positive().optional().nullable(),
});

function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function dateStr(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const posRouter = router({
  checkout: protectedProcedure.input(checkoutSchema).mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const variantIds = input.items.map(i => i.variantId);
      const variants = await tx.select({
        id: productVariants.id,
        productId: productVariants.productId,
        label: productVariants.label,
        sellingPrice: productVariants.sellingPrice,
        costPrice: productVariants.costPrice,
        stock: productVariants.stock,
        isActive: productVariants.isActive,
        productName: products.name,
        productActive: products.isActive,
      }).from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(sql`${productVariants.id} IN ${variantIds}`);

      const vMap = new Map(variants.map(v => [v.id, v]));

      // Query any quantity price tiers for these variants
      const tiers = await tx.select().from(priceTiers).where(inArray(priceTiers.variantId, variantIds));
      const tiersMap = new Map<number, { minQty: number; unitPrice: number }[]>();
      for (const t of tiers) {
        const list = tiersMap.get(t.variantId) ?? [];
        list.push({ minQty: t.minQty, unitPrice: t.unitPrice });
        tiersMap.set(t.variantId, list);
      }

      let subtotal = 0;
      let itemDiscountTotal = 0;
      const lines = input.items.map(it => {
        const v = vMap.get(it.variantId);
        if (!v) throw new Error(`Varian ${it.variantId} tidak ditemukan`);
        if (!v.isActive || !v.productActive) throw new Error(`${v.productName} tidak aktif`);
        if (it.qty <= 0) throw new Error(`Kuantitas harus > 0 untuk ${v.productName}`);
        if (v.stock < it.qty) throw new Error(`Stok tidak cukup: ${v.productName} (${v.label}) sisa ${v.stock}`);

        // Evaluate tiered pricing if applicable
        const variantTiers = tiersMap.get(v.id) ?? [];
        const baseCalculatedPrice = getTieredUnitPrice(v.sellingPrice, variantTiers, it.qty);

        const unitPrice = it.unitPrice ?? baseCalculatedPrice;
        if (unitPrice !== baseCalculatedPrice && ctx.user.role === "kasir") {
          throw new Error(`Ubah harga manual hanya boleh oleh owner/admin: ${v.productName}`);
        }
        if (it.discount > it.qty * unitPrice) throw new Error(`Diskon melebihi harga untuk ${v.productName}`);
        const lineTotal = calcLineTotal(it.qty, unitPrice, it.discount);
        subtotal += it.qty * unitPrice;
        itemDiscountTotal += it.discount;
        return { variant: v, ...it, unitPrice, lineTotal };
      });

      let trxDiscount = 0;
      if (input.trxDiscountType && input.trxDiscountValue > 0) {
        trxDiscount = applyTransactionDiscount(subtotal - itemDiscountTotal, input.trxDiscountType, input.trxDiscountValue);
      }
      const afterTrxDisc = Math.max(0, subtotal - itemDiscountTotal - trxDiscount);

      let voucherDiscount = 0;
      let voucherCodeUsed: string | null = null;
      if (input.voucherCode) {
        const code = input.voucherCode.trim().toUpperCase();
        const [v] = await tx.select().from(vouchers).where(eq(vouchers.code, code));
        const today = dateStr(new Date());
        if (!v || !v.isActive) throw new Error("Voucher tidak valid");
        if (v.validFrom > today) throw new Error("Voucher belum berlaku");
        if (v.validUntil && v.validUntil < today) throw new Error("Voucher sudah kedaluwarsa");
        if (v.usageLimit !== null && v.usedCount >= v.usageLimit) throw new Error("Batas penggunaan voucher habis");
        const res = applyVoucher(afterTrxDisc, v.type as "fixed" | "percentage", v.value, v.minPurchase, v.maxDiscount ?? undefined);
        if (!res.valid) throw new Error(res.reason ?? "Voucher tidak dapat dipakai");
        voucherDiscount = res.discount;
        voucherCodeUsed = code;
        await tx.update(vouchers).set({ usedCount: sql`${vouchers.usedCount} + 1` }).where(eq(vouchers.id, v.id));
      }

      const total = Math.max(0, afterTrxDisc - voucherDiscount);
      if (total < 0) throw new Error("Total tidak boleh negatif");
      const isCredit = input.paymentMethod === "kredit";
      if (!isCredit && input.paidAmount < total) {
        throw new Error("Nominal bayar kurang dari total (hanya kredit boleh kurang)");
      }

      // Invoice number: INV-YYYYMMDD-NNNN — atomik via invoice_counters
      const day = todayStr();
      const [counter] = await tx.select().from(invoiceCounters).where(eq(invoiceCounters.day, day));
      let nextNo = 1;
      if (counter) {
        nextNo = counter.lastNo + 1;
        await tx.update(invoiceCounters).set({ lastNo: nextNo }).where(eq(invoiceCounters.day, day));
      } else {
        await tx.insert(invoiceCounters).values({ day, lastNo: nextNo });
      }
      const invoiceNo = `INV-${day}-${String(nextNo).padStart(4, "0")}`;

      const changeAmount = Math.max(0, input.paidAmount - total);
      const unpaid = total - Math.min(input.paidAmount, total);

      if (unpaid > 0) {
        if (!input.customerName?.trim()) throw new Error("Nama pelanggan wajib untuk penjualan kredit/piutang");
        if (!input.dueDate) throw new Error("Tanggal jatuh tempo wajib untuk piutang");
      }

      const [sale] = await tx.insert(sales).values({
        invoiceNo,
        cashierId: ctx.user.id,
        subtotal,
        discountTotal: itemDiscountTotal + trxDiscount,
        voucherCode: voucherCodeUsed,
        voucherDiscount,
        total,
        paymentMethod: input.paymentMethod,
        paidAmount: Math.min(input.paidAmount, total),
        changeAmount,
        status: "completed",
        customerName: input.customerName ?? null,
        dueDate: unpaid > 0 ? input.dueDate : null,
      }).returning({ id: sales.id });

      for (const line of lines) {
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: line.variant.productId,
          variantId: line.variant.id,
          name: `${line.variant.productName} — ${line.variant.label}`,
          qty: line.qty,
          unitPrice: line.unitPrice,
          costPriceAtSale: line.variant.costPrice,
          discount: line.discount,
          lineTotal: line.lineTotal,
        });
        await tx.update(productVariants).set({ stock: sql`${productVariants.stock} - ${line.qty}` }).where(eq(productVariants.id, line.variant.id));
        await tx.update(products).set({ stock: sql`${products.stock} - ${line.qty}` }).where(eq(products.id, line.variant.productId));
        await tx.insert(inventoryMovements).values({
          productId: line.variant.productId,
          variantId: line.variant.id,
          type: "sale",
          qty: -line.qty,
          refType: "sale",
          refId: sale.id,
          note: `Penjualan ${invoiceNo}`,
          createdBy: ctx.user.id,
        });
      }

      await tx.insert(salePayments).values({
        saleId: sale.id,
        method: input.paymentMethod,
        amount: Math.min(input.paidAmount, total),
        referenceNo: input.referenceNo ?? null,
      });

      if (unpaid > 0) {
        await tx.insert(receivables).values({
          saleId: sale.id,
          customerName: input.customerName!.trim(),
          amount: unpaid,
          paidAmount: 0,
          dueDate: input.dueDate!,
          status: "open",
        });
      }

      // If this checkout restores and completes a held cart, remove the held cart
      if (input.heldCartId) {
        await tx.delete(heldCarts).where(eq(heldCarts.id, input.heldCartId));
      }

      return { saleId: sale.id, invoiceNo, total, changeAmount, unpaid };
    });
  }),

  // ---- Hold / Parked Cart Feature ----
  holdCart: protectedProcedure.input(z.object({
    label: z.string().min(1).max(100),
    cartJson: z.string().min(2),
    subtotal: z.number().int().min(0),
  })).mutation(async ({ input, ctx }) => {
    const [held] = await db.insert(heldCarts).values({
      cashierId: ctx.user.id,
      label: input.label,
      cartJson: input.cartJson,
      subtotal: input.subtotal,
    }).returning({ id: heldCarts.id });
    return { id: held.id };
  }),

  listHeldCarts: protectedProcedure.query(async ({ ctx }) => {
    return db.select()
      .from(heldCarts)
      .where(eq(heldCarts.cashierId, ctx.user.id))
      .orderBy(desc(heldCarts.createdAt));
  }),

  deleteHeldCart: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.delete(heldCarts).where(eq(heldCarts.id, input.id));
    return { ok: true };
  }),

  getSale: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const [s] = await db.select({
      id: sales.id,
      invoiceNo: sales.invoiceNo,
      subtotal: sales.subtotal,
      discountTotal: sales.discountTotal,
      voucherCode: sales.voucherCode,
      voucherDiscount: sales.voucherDiscount,
      total: sales.total,
      paymentMethod: sales.paymentMethod,
      paidAmount: sales.paidAmount,
      changeAmount: sales.changeAmount,
      customerName: sales.customerName,
      createdAt: sales.createdAt,
      cashierName: sql<string>`(SELECT name FROM users WHERE users.id = ${sales.cashierId})`,
    }).from(sales).where(eq(sales.id, input.id)).limit(1);
    if (!s) throw new Error("Transaksi tidak ditemukan");
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, s.id));
    return { ...s, items };
  }),

  listSales: protectedProcedure.input(z.object({
    q: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  })).query(async ({ input }) => {
    const where = [];
    if (input.q) where.push(sql`${sales.invoiceNo} LIKE ${`%${input.q}%`}`);
    if (input.from) where.push(gte(sales.createdAt, new Date(input.from)));
    if (input.to) where.push(lte(sales.createdAt, new Date(`${input.to}T23:59:59`)));
    const items = await db.select().from(sales).where(where.length ? and(...where) : undefined).orderBy(desc(sales.createdAt)).limit(input.limit).offset(input.offset);
    const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(sales).where(where.length ? and(...where) : undefined);
    return { items, total: Number(c) };
  }),

  validateVoucher: protectedProcedure.input(z.object({ code: z.string().min(1), subtotal: z.number().int().min(0) })).query(async ({ input }) => {
    const code = input.code.trim().toUpperCase();
    const [v] = await db.select().from(vouchers).where(eq(vouchers.code, code)).limit(1);
    const today = dateStr(new Date());
    if (!v || !v.isActive) return { valid: false as const, reason: "Voucher tidak valid" };
    if (v.validFrom > today) return { valid: false as const, reason: "Voucher belum berlaku" };
    if (v.validUntil && v.validUntil < today) return { valid: false as const, reason: "Voucher sudah kedaluwarsa" };
    if (v.usageLimit !== null && v.usedCount >= v.usageLimit) return { valid: false as const, reason: "Batas penggunaan habis" };
    const res = applyVoucher(input.subtotal, v.type as "fixed" | "percentage", v.value, v.minPurchase, v.maxDiscount ?? undefined);
    if (!res.valid) return { valid: false as const, reason: res.reason };
    return { valid: true as const, discount: res.discount, code: v.code, type: v.type, value: v.value };
  }),

  variantDetail: protectedProcedure.input(z.object({ variantId: z.number().int().positive() })).query(async ({ input }) => {
    const [v] = await db.select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      label: productVariants.label,
      sellingPrice: productVariants.sellingPrice,
      stock: productVariants.stock,
      productName: products.name,
    }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(productVariants.id, input.variantId), eq(productVariants.isActive, true))).limit(1);
    return v ?? null;
  }),

  recordPick: protectedProcedure.input(z.object({ variantId: z.number().int().positive() })).mutation(async ({ input }) => {
    const [v] = await db.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, input.variantId)).limit(1);
    if (!v) return { ok: false };
    await db.insert(searchFrequency).values({ skuKey: `${v.productId}:${input.variantId}`, count: 1 })
      .onConflictDoUpdate({ target: searchFrequency.skuKey, set: { count: sql`${searchFrequency.count} + 1` } });
    return { ok: true };
  }),

  frequentSkuKeys: protectedProcedure.query(async () => {
    const rows = await db.select().from(searchFrequency).orderBy(desc(searchFrequency.count)).limit(20);
    const variantIds = rows.map(r => Number(r.skuKey.split(":")[1])).filter(n => Number.isFinite(n));
    if (!variantIds.length) return [];
    const details = await db.select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      label: productVariants.label,
      sellingPrice: productVariants.sellingPrice,
      stock: productVariants.stock,
      name: products.name,
    }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId))
      .where(sql`${productVariants.id} IN ${variantIds}`);
    const dMap = new Map(details.map(d => [d.variantId, d]));
    return rows
      .map(r => {
        const vid = Number(r.skuKey.split(":")[1]);
        const d = dMap.get(vid);
        return d ? { ...d, count: r.count } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.count - a.count);
  }),
});
