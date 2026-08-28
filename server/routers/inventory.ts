import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { inventoryMovements, stockOpnames, stockOpnameItems, productVariants, products, users } from "../../drizzle/schema.js";
import { eq, sql, and, desc, gte, lte } from "drizzle-orm";
import { z } from "zod";

export const inventoryRouter = router({
  movements: protectedProcedure.input(z.object({
    productId: z.number().int().positive().optional(),
    type: z.enum(["purchase", "sale", "opname", "adjustment"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  })).query(async ({ input }) => {
    const where = [];
    if (input.productId) where.push(eq(inventoryMovements.productId, input.productId));
    if (input.type) where.push(eq(inventoryMovements.type, input.type));
    if (input.from) where.push(gte(inventoryMovements.createdAt, new Date(input.from)));
    if (input.to) where.push(lte(inventoryMovements.createdAt, new Date(`${input.to}T23:59:59`)));
    const items = await db.select({
      id: inventoryMovements.id,
      productId: inventoryMovements.productId,
      variantId: inventoryMovements.variantId,
      productName: products.name,
      variantLabel: productVariants.label,
      type: inventoryMovements.type,
      qty: inventoryMovements.qty,
      refType: inventoryMovements.refType,
      refId: inventoryMovements.refId,
      note: inventoryMovements.note,
      createdAt: inventoryMovements.createdAt,
      userName: users.name,
    }).from(inventoryMovements)
      .innerJoin(products, eq(products.id, inventoryMovements.productId))
      .leftJoin(productVariants, eq(productVariants.id, inventoryMovements.variantId))
      .innerJoin(users, eq(users.id, inventoryMovements.createdBy))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
      .limit(input.limit);
    return items;
  }),

  adjustStock: adminProcedure.input(z.object({
    variantId: z.number().int().positive(),
    deltaQty: z.number().int(),
    reason: z.string().min(3).max(200),
  })).mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, input.variantId));
      if (!v) throw new Error("Varian tidak ditemukan");
      if (v.stock + input.deltaQty < 0) throw new Error("Hasil penyesuaian tidak boleh negatif");
      await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${input.deltaQty}` }).where(eq(productVariants.id, v.id));
      await tx.update(products).set({ stock: sql`${products.stock} + ${input.deltaQty}` }).where(eq(products.id, v.productId));
      await tx.insert(inventoryMovements).values({
        productId: v.productId,
        variantId: v.id,
        type: "adjustment",
        qty: input.deltaQty,
        refType: "adjustment",
        note: input.reason,
        createdBy: ctx.user.id,
      });
      return { ok: true };
    });
  }),

  // ---- Stock Opname ----
  opnameList: protectedProcedure.query(async () => {
    return db.select({
      id: stockOpnames.id,
      code: stockOpnames.code,
      status: stockOpnames.status,
      responsibleName: stockOpnames.responsibleName,
      finalizedAt: stockOpnames.finalizedAt,
      createdAt: stockOpnames.createdAt,
      itemCount: sql<number>`(SELECT count(*) FROM stock_opname_items WHERE stock_opname_items.opname_id = ${stockOpnames.id})`,
    }).from(stockOpnames).orderBy(desc(stockOpnames.createdAt)).limit(50);
  }),

  opnameCreate: adminProcedure.input(z.object({
    responsibleName: z.string().min(1).max(128),
    note: z.string().max(500).optional().nullable(),
  })).mutation(async ({ input, ctx }) => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const code = `OPN-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${Date.now() % 10000}`;
    const [o] = await db.insert(stockOpnames).values({
      code,
      status: "open",
      responsibleName: input.responsibleName,
      responsibleUserId: ctx.user.id,
      note: input.note ?? null,
    }).returning({ id: stockOpnames.id });
    return { id: Number(o.id), code };
  }),

  opnameGet: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const [o] = await db.select().from(stockOpnames).where(eq(stockOpnames.id, input.id)).limit(1);
    if (!o) throw new Error("Sesi opname tidak ditemukan");
    const items = await db.select({
      id: stockOpnameItems.id,
      variantId: stockOpnameItems.variantId,
      systemStock: stockOpnameItems.systemStock,
      physicalStock: stockOpnameItems.physicalStock,
      diff: stockOpnameItems.diff,
      reason: stockOpnameItems.reason,
      productName: products.name,
      variantLabel: productVariants.label,
    }).from(stockOpnameItems)
      .innerJoin(productVariants, eq(productVariants.id, stockOpnameItems.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(stockOpnameItems.opnameId, o.id));
    return { ...o, items };
  }),

  opnameAddItem: adminProcedure.input(z.object({
    opnameId: z.number().int().positive(),
    variantId: z.number().int().positive(),
    physicalStock: z.number().int().min(0),
    reason: z.string().max(200).optional().nullable(),
  })).mutation(async ({ input }) => {
    return db.transaction(async (tx) => {
      const [o] = await tx.select().from(stockOpnames).where(eq(stockOpnames.id, input.opnameId)).limit(1);
      if (!o) throw new Error("Sesi opname tidak ditemukan");
      if (o.status !== "open") throw new Error("Sesi sudah difinalisasi");
      const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, input.variantId)).limit(1);
      if (!v) throw new Error("Varian tidak ditemukan");
      const existing = await tx.select({ id: stockOpnameItems.id }).from(stockOpnameItems)
        .where(and(eq(stockOpnameItems.opnameId, o.id), eq(stockOpnameItems.variantId, v.id))).limit(1);
      if (existing.length) throw new Error("Varian sudah ada di sesi ini");
      await tx.insert(stockOpnameItems).values({
        opnameId: o.id,
        variantId: v.id,
        systemStock: v.stock,
        physicalStock: input.physicalStock,
        diff: input.physicalStock - v.stock,
        reason: input.reason ?? null,
      });
      return { ok: true };
    });
  }),

  opnameFinalize: adminProcedure.input(z.object({
    opnameId: z.number().int().positive(),
  })).mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const [o] = await tx.select().from(stockOpnames).where(eq(stockOpnames.id, input.opnameId));
      if (!o) throw new Error("Sesi opname tidak ditemukan");
      if (o.status !== "open") throw new Error("Sesi sudah difinalisasi");
      const items = await tx.select().from(stockOpnameItems).where(eq(stockOpnameItems.opnameId, o.id));
      if (!items.length) throw new Error("Tidak ada item untuk difinalisasi");
      for (const it of items) {
        if (it.diff === 0) continue;
        const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, it.variantId));
        if (!v) continue;
        await tx.update(productVariants).set({ stock: v.stock + it.diff }).where(eq(productVariants.id, v.id));
        await tx.update(products).set({ stock: sql`${products.stock} + ${it.diff}` }).where(eq(products.id, v.productId));
        await tx.insert(inventoryMovements).values({
          productId: v.productId,
          variantId: v.id,
          type: "opname",
          qty: it.diff,
          refType: "opname",
          refId: o.id,
          note: `Opname ${o.code}${it.reason ? ` — ${it.reason}` : ""}`,
          createdBy: ctx.user.id,
        });
      }
      await tx.update(stockOpnames).set({ status: "finalized", finalizedAt: new Date() }).where(eq(stockOpnames.id, o.id));
      return { ok: true };
    });
  }),

  opnameCancel: adminProcedure.input(z.object({ opnameId: z.number().int().positive() })).mutation(async ({ input }) => {
    const [o] = await db.select().from(stockOpnames).where(eq(stockOpnames.id, input.opnameId)).limit(1);
    if (!o) throw new Error("Sesi opname tidak ditemukan");
    if (o.status !== "open") throw new Error("Hanya sesi open yang bisa dibatalkan");
    await db.update(stockOpnames).set({ status: "cancelled" }).where(eq(stockOpnames.id, o.id));
    return { ok: true };
  }),

  variantsForPick: protectedProcedure.input(z.object({ q: z.string().optional(), limit: z.number().int().min(1).max(50).default(20) })).query(async ({ input }) => {
    const where = [eq(products.isActive, true), eq(productVariants.isActive, true)];
    if (input.q) {
      const q = `%${input.q}%`;
      where.push(sql`(${products.name} LIKE ${q} OR ${productVariants.label} LIKE ${q} OR COALESCE(${productVariants.barcode},'') LIKE ${q} OR COALESCE(${products.barcode},'') LIKE ${q})`);
    }
    return db.select({
      variantId: productVariants.id,
      productId: products.id,
      name: products.name,
      label: productVariants.label,
      barcode: productVariants.barcode,
      stock: productVariants.stock,
      sellingPrice: productVariants.sellingPrice,
    }).from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(...where))
      .orderBy(products.name).limit(input.limit);
  }),
});
