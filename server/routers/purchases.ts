import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { purchases, purchaseItems, productVariants, products, suppliers, inventoryMovements } from "../../drizzle/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import { z } from "zod";

const itemSchema = z.object({
  variantId: z.number().int().positive(),
  qtyOrdered: z.number().int().min(1),
  unitCost: z.number().int().min(0),
});

const createSchema = z.object({
  supplierId: z.number().int().positive(),
  invoiceNo: z.string().min(1).max(64),
  notes: z.string().max(2000).optional().nullable(),
  expectedAt: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1),
});

export const purchasesRouter = router({
  list: protectedProcedure
    .input(z.object({
      q: z.string().optional(),
      status: z.enum(["draft", "ordered", "partial", "received", "cancelled"]).optional(),
      supplierId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const where = [];
      if (input.status) where.push(eq(purchases.status, input.status));
      if (input.supplierId) where.push(eq(purchases.supplierId, input.supplierId));
      if (input.q) where.push(sql`${purchases.invoiceNo} LIKE ${`%${input.q}%`}`);
      const items = await db.select({
        id: purchases.id,
        invoiceNo: purchases.invoiceNo,
        status: purchases.status,
        totalCost: purchases.totalCost,
        expectedAt: purchases.expectedAt,
        receivedAt: purchases.receivedAt,
        createdAt: purchases.createdAt,
        supplierName: suppliers.name,
      }).from(purchases).innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(purchases.createdAt)).limit(input.limit).offset(input.offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(purchases).where(where.length ? and(...where) : undefined);
      return { items, total: Number(count) };
    }),

  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const [p] = await db.select({
      id: purchases.id,
      invoiceNo: purchases.invoiceNo,
      status: purchases.status,
      totalCost: purchases.totalCost,
      notes: purchases.notes,
      expectedAt: purchases.expectedAt,
      receivedAt: purchases.receivedAt,
      createdAt: purchases.createdAt,
      supplierId: purchases.supplierId,
      supplierName: suppliers.name,
      supplierPhone: suppliers.phone,
    }).from(purchases).innerJoin(suppliers, eq(suppliers.id, purchases.supplierId)).where(eq(purchases.id, input.id)).limit(1);
    if (!p) throw new Error("Pembelian tidak ditemukan");
    const items = await db.select({
      id: purchaseItems.id,
      variantId: purchaseItems.variantId,
      qtyOrdered: purchaseItems.qtyOrdered,
      qtyReceived: purchaseItems.qtyReceived,
      unitCost: purchaseItems.unitCost,
      variantLabel: productVariants.label,
      variantBarcode: productVariants.barcode,
      productName: products.name,
    }).from(purchaseItems)
      .innerJoin(productVariants, eq(productVariants.id, purchaseItems.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(purchaseItems.purchaseId, input.id));
    return { ...p, items };
  }),

  create: adminProcedure.input(createSchema).mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const total = input.items.reduce((s, i) => s + i.qtyOrdered * i.unitCost, 0);
      const [p] = await tx.insert(purchases).values({
        supplierId: input.supplierId,
        invoiceNo: input.invoiceNo,
        status: "ordered",
        totalCost: total,
        notes: input.notes ?? null,
        expectedAt: input.expectedAt || null,
        createdBy: ctx.user.id,
      }).$returningId();
      for (const it of input.items) {
        await tx.insert(purchaseItems).values({
          purchaseId: p.id,
          variantId: it.variantId,
          qtyOrdered: it.qtyOrdered,
          unitCost: it.unitCost,
        });
      }
      return { id: p.id };
    });
  }),

  receive: adminProcedure.input(z.object({
    purchaseId: z.number().int().positive(),
    receipts: z.array(z.object({
      itemId: z.number().int().positive(),
      receiveQty: z.number().int().min(0),
      updateCostPrice: z.boolean().default(true),
    })).min(1),
  })).mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const [purchase] = await tx.select().from(purchases).where(eq(purchases.id, input.purchaseId)).limit(1);
      if (!purchase) throw new Error("Pembelian tidak ditemukan");
      if (purchase.status === "received") throw new Error("Pembelian sudah diterima penuh");
      if (purchase.status === "cancelled") throw new Error("Pembelian dibatalkan");

      const items = await tx.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, input.purchaseId));
      const itemMap = new Map(items.map(i => [i.id, i]));
      // kuantitas tambahan per item dalam request ini (deteksi duplikat itemId)
      const appliedInRequest = new Map<number, number>();

      for (const r of input.receipts) {
        const item = itemMap.get(r.itemId);
        if (!item) throw new Error(`Item pembelian ${r.itemId} tidak valid`);
        const already = appliedInRequest.get(r.itemId) ?? 0;
        const remaining = item.qtyOrdered - item.qtyReceived - already;
        if (r.receiveQty > remaining) throw new Error(`Qty terima melebihi sisa (sisa ${Math.max(0, remaining)})`);
        appliedInRequest.set(r.itemId, already + r.receiveQty);
        if (r.receiveQty <= 0) continue;

        const newReceived = item.qtyReceived + already + r.receiveQty;

        await tx.update(purchaseItems).set({ qtyReceived: newReceived }).where(eq(purchaseItems.id, item.id));

        const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1);
        if (!variant) throw new Error("Varian tidak ditemukan");
        await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${r.receiveQty}` }).where(eq(productVariants.id, variant.id));
        await tx.update(products).set({ stock: sql`${products.stock} + ${r.receiveQty}` }).where(eq(products.id, variant.productId));

        if (r.updateCostPrice && item.unitCost !== variant.costPrice) {
          await tx.update(productVariants).set({ costPrice: item.unitCost }).where(eq(productVariants.id, variant.id));
        }

        await tx.insert(inventoryMovements).values({
          productId: variant.productId,
          variantId: variant.id,
          type: "purchase",
          qty: r.receiveQty,
          refType: "purchase",
          refId: purchase.id,
          note: `Terima ${purchase.invoiceNo}`,
          createdBy: ctx.user.id,
        });
      }

      // Status akhir dihitung dari SEMUA item pembelian (item yang tak disebut
      // di receipts pun ikut menentukan apakah penerimaan sudah penuh).
      const finalAllFull = items.every(it => {
        const extra = appliedInRequest.get(it.id) ?? 0;
        return it.qtyReceived + extra >= it.qtyOrdered;
      });

      await tx.update(purchases).set({
        status: finalAllFull ? "received" : "partial",
        receivedAt: finalAllFull ? new Date() : null,
        receivedBy: ctx.user.id,
      }).where(eq(purchases.id, purchase.id));
      return { ok: true, status: finalAllFull ? "received" : "partial" };
    });
  }),

  cancel: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const [p] = await db.select().from(purchases).where(eq(purchases.id, input.id)).limit(1);
    if (!p) throw new Error("Pembelian tidak ditemukan");
    if (p.status === "received") throw new Error("Pembelian diterima tidak bisa dibatalkan");
    await db.update(purchases).set({ status: "cancelled" }).where(eq(purchases.id, input.id));
    return { ok: true };
  }),
});



