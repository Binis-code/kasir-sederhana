import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { products, productVariants, saleItems, purchaseItems, stockOpnameItems, inventoryMovements, searchFrequency } from "../../drizzle/schema.js";
import { eq, desc, like, or, and, sql, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { formatRupiah } from "../../shared/money.js";

const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().min(1).max(64),
  barcode: z.string().max(64).optional().nullable(),
  sellingPrice: z.number().int().min(0),
  costPrice: z.number().int().min(0),
  stock: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const productCreateSchema = z.object({
  name: z.string().min(1).max(128),
  category: z.string().min(1).max(64),
  barcode: z.string().max(64).optional().nullable(),
  minStock: z.number().int().min(0).default(0),
  variants: z.array(variantSchema).min(1),
});

const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

export const productsRouter = router({
  list: protectedProcedure
    .input(z.object({
      q: z.string().optional(),
      category: z.string().optional(),
      lowStock: z.boolean().optional(),
      activeOnly: z.boolean().default(true),
      limit: z.number().int().min(1).max(200).default(100),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const where = [];
      if (input.activeOnly) where.push(eq(products.isActive, true));
      if (input.lowStock) where.push(and(eq(products.isActive, true), sql`${products.stock} <= ${products.minStock}`));
      if (input.category) where.push(eq(products.category, input.category));
      if (input.q) {
        const q = `%${input.q}%`;
        where.push(or(
          like(products.name, q),
          like(products.category, q),
          like(products.barcode, q),
          sql`EXISTS (SELECT 1 FROM ${productVariants} WHERE ${productVariants.productId} = ${products.id} AND (${like(productVariants.barcode, q)} OR ${like(productVariants.label, q)}))`
        ));
      }
      const items = await db.select({
        id: products.id,
        name: products.name,
        category: products.category,
        barcode: products.barcode,
        stock: products.stock,
        minStock: products.minStock,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      }).from(products).where(where.length ? and(...where) : undefined).orderBy(desc(products.createdAt)).limit(input.limit).offset(input.offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(products).where(where.length ? and(...where) : undefined);
      return { items, total: Number(count) };
    }),

  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const [p] = await db.select().from(products).where(eq(products.id, input.id)).limit(1);
    if (!p) throw new Error("Produk tidak ditemukan");
    const vars = await db.select().from(productVariants).where(eq(productVariants.productId, input.id)).orderBy(productVariants.id);
    return { ...p, variants: vars };
  }),

  categories: protectedProcedure.query(async () => {
    const rows = await db.selectDistinct({ category: products.category }).from(products).where(eq(products.isActive, true));
    return rows.map(r => r.category).filter(Boolean);
  }),

  create: adminProcedure.input(productCreateSchema).mutation(async ({ input }) => {
    return db.transaction(async (tx) => {
      const { variants, ...prod } = input;
      const [p] = await tx.insert(products).values({ ...prod, stock: 0 }).$returningId();
      let totalStock = 0;
      for (const v of variants) {
        const { id, ...vData } = v;
        await tx.insert(productVariants).values({ ...vData, productId: p.id });
        totalStock += vData.stock;
      }
      await tx.update(products).set({ stock: totalStock }).where(eq(products.id, p.id));
      return { id: p.id };
    });
  }),

  update: adminProcedure.input(productUpdateSchema).mutation(async ({ input }) => {
    const { id, variants, ...prod } = input;
    return db.transaction(async (tx) => {
      if (Object.keys(prod).length) {
        await tx.update(products).set(prod).where(eq(products.id, id));
      }
      if (!variants) return { ok: true };
      const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, id));
      const existingMap = new Map(existing.map(v => [v.id, v]));
      const keptIds = new Set<number>();
      let totalStock = 0;
      for (const v of variants) {
        const { id: vId, stock, ...vData } = v;
        if (vId && existingMap.has(vId)) {
          // Stok varian eksisting TIDAK boleh dari klien (hindari timpa balik stok basi);
          // perubahan stok hanya lewat penyesuaian/pembelian/opname.
          await tx.update(productVariants).set({ ...vData, isActive: true }).where(eq(productVariants.id, vId));
          keptIds.add(vId);
          totalStock += existingMap.get(vId)!.stock;
        } else {
          await tx.insert(productVariants).values({ ...vData, stock, productId: id });
          totalStock += stock;
        }
      }
      // Varian yang dihapus dari form: deaktivasi (bukan delete) agar riwayat
      // sale_items / purchase_items / movements tidak rusak FK; barcode dibebaskan.
      for (const vid of existingMap.keys()) {
        if (!keptIds.has(vid)) {
          await tx.update(productVariants).set({ isActive: false, barcode: null }).where(eq(productVariants.id, vid));
        }
      }
      await tx.update(products).set({ stock: totalStock }).where(eq(products.id, id));
      return { ok: true };
    });
  }),

  archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.update(products).set({ isActive: false }).where(eq(products.id, input.id));
    return { ok: true };
  }),

  // Hapus permanen HANYA untuk produk yang benar-benar belum terpakai.
  // Jika sudah punya riwayat (penjualan/pembelian/opname/mutasi), server menolak
  // agar jejak inventori tetap utuh — gunakan arsip.
  delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    return db.transaction(async (tx) => {
      const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, input.id)).limit(1);
      if (!p) throw new Error("Produk tidak ditemukan");
      const vars = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, input.id));
      const varIds = vars.map(v => v.id);

      let refCount = 0;
      const [{ c: siC }] = await tx.select({ c: sql<number>`count(*)` }).from(saleItems).where(eq(saleItems.productId, input.id));
      refCount += Number(siC);
      const [{ c: mvC }] = await tx.select({ c: sql<number>`count(*)` }).from(inventoryMovements).where(eq(inventoryMovements.productId, input.id));
      refCount += Number(mvC);
      if (varIds.length) {
        const [{ c: piC }] = await tx.select({ c: sql<number>`count(*)` }).from(purchaseItems).where(inArray(purchaseItems.variantId, varIds));
        const [{ c: oiC }] = await tx.select({ c: sql<number>`count(*)` }).from(stockOpnameItems).where(inArray(stockOpnameItems.variantId, varIds));
        refCount += Number(piC) + Number(oiC);
      }
      if (refCount > 0) {
        throw new Error("Produk punya riwayat transaksi/mutasi stok sehingga tidak bisa dihapus permanen. Gunakan Arsipkan.");
      }
      await tx.delete(products).where(eq(products.id, input.id)); // varian ikut terhapus (cascade)
      await tx.delete(searchFrequency).where(like(searchFrequency.skuKey, `${input.id}:%`));
      return { ok: true };
    });
  }),

  search: protectedProcedure.input(z.object({ q: z.string().min(1), limit: z.number().int().min(1).max(20).default(10) })).query(async ({ input }) => {
    const q = `%${input.q}%`;
    const items = await db.select({
      id: products.id,
      name: products.name,
      category: products.category,
      barcode: products.barcode,
      stock: products.stock,
      sellingPrice: productVariants.sellingPrice,
      variantLabel: productVariants.label,
      variantId: productVariants.id,
    }).from(products).leftJoin(productVariants, eq(productVariants.productId, products.id))
      .where(and(eq(products.isActive, true), eq(productVariants.isActive, true), or(like(products.name, q), like(products.barcode, q), like(products.category, q), like(productVariants.barcode, q), like(productVariants.label, q))))
      .limit(input.limit);
    return items.map(i => ({
      productId: i.id,
      name: i.name,
      category: i.category,
      barcode: i.barcode,
      stock: i.stock,
      price: i.sellingPrice ?? 0,
      variant: i.variantId != null
        ? { id: i.variantId, label: i.variantLabel ?? "", price: i.sellingPrice ?? 0 }
        : null,
    }));
  }),

  byBarcode: protectedProcedure.input(z.object({ barcode: z.string().min(1) })).query(async ({ input }) => {
    const [pv] = await db.select({
      variantId: productVariants.id,
      productId: products.id,
      name: products.name,
      category: products.category,
      label: productVariants.label,
      barcode: productVariants.barcode,
      sellingPrice: productVariants.sellingPrice,
      costPrice: productVariants.costPrice,
      stock: productVariants.stock,
      productStock: products.stock,
      minStock: products.minStock,
    }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(eq(productVariants.barcode, input.barcode), eq(productVariants.isActive, true), eq(products.isActive, true)))
      .limit(1);
    if (!pv) return null;
    return pv;
  }),
});


