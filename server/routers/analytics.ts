import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { saleItems, productVariants, products, productBatches } from "../../drizzle/schema.js";
import { sql, eq, desc, inArray, and, lte } from "drizzle-orm";

export const analyticsRouter = router({
  crossSellSuggestions: protectedProcedure
    .input(z.object({
      variantIds: z.array(z.number()),
    }))
    .query(async ({ input }: { input: { variantIds: number[] } }) => {
      if (!input.variantIds.length) return [];

      // Find sales that contain any of the input variantIds
      const matchingSales = await db
        .select({ saleId: saleItems.saleId })
        .from(saleItems)
        .where(inArray(saleItems.variantId, input.variantIds))
        .limit(200);

      const saleIds = Array.from(new Set(matchingSales.map((s: { saleId: number }) => s.saleId)));
      if (!saleIds.length) {
        // Fallback: return top 3 selling variants not currently in cart
        const fallback = await db
          .select({
            variantId: productVariants.id,
            productName: products.name,
            variantLabel: productVariants.label,
            sellingPrice: productVariants.sellingPrice,
            stock: productVariants.stock,
            score: sql<number>`count(${saleItems.id})`.as("score"),
          })
          .from(saleItems)
          .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(sql`${productVariants.id} NOT IN (${sql.raw(input.variantIds.join(","))}) AND ${productVariants.stock} > 0`)
          .groupBy(productVariants.id)
          .orderBy(desc(sql`score`))
          .limit(3);

        return fallback;
      }

      // Find other items frequently bought together in those sales
      const coOccurred = await db
        .select({
          variantId: productVariants.id,
          productName: products.name,
          variantLabel: productVariants.label,
          sellingPrice: productVariants.sellingPrice,
          stock: productVariants.stock,
          coCount: sql<number>`count(distinct ${saleItems.saleId})`.as("coCount"),
        })
        .from(saleItems)
        .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(
          and(
            inArray(saleItems.saleId, saleIds),
            sql`${productVariants.id} NOT IN (${sql.raw(input.variantIds.join(","))})`,
            sql`${productVariants.stock} > 0`
          )
        )
        .groupBy(productVariants.id)
        .orderBy(desc(sql`coCount`))
        .limit(3);

      return coOccurred;
    }),

  expiryAlerts: protectedProcedure
    .input(z.object({
      daysThreshold: z.number().default(30),
    }).optional())
    .query(async ({ input }: { input?: { daysThreshold?: number } }) => {
      const thresholdDays = input?.daysThreshold ?? 30;
      const targetDate = new Date(Date.now() + thresholdDays * 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const rows = await db
        .select({
          id: productBatches.id,
          batchNo: productBatches.batchNo,
          expiryDate: productBatches.expiryDate,
          qty: productBatches.qty,
          costPrice: productBatches.costPrice,
          variantId: productBatches.variantId,
          variantLabel: productVariants.label,
          productName: products.name,
          sellingPrice: productVariants.sellingPrice,
        })
        .from(productBatches)
        .innerJoin(productVariants, eq(productBatches.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(lte(productBatches.expiryDate, targetDate))
        .orderBy(productBatches.expiryDate);

      return rows.map((r: typeof rows[0]) => {
        const isExpired = r.expiryDate < today;
        const daysLeft = Math.ceil((new Date(r.expiryDate).getTime() - Date.now()) / 86400000);
        return {
          ...r,
          isExpired,
          daysLeft,
        };
      });
    }),

  listBatches: protectedProcedure.query(async () => {
    return db
      .select({
        id: productBatches.id,
        batchNo: productBatches.batchNo,
        expiryDate: productBatches.expiryDate,
        qty: productBatches.qty,
        costPrice: productBatches.costPrice,
        variantId: productBatches.variantId,
        variantLabel: productVariants.label,
        productName: products.name,
      })
      .from(productBatches)
      .innerJoin(productVariants, eq(productBatches.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .orderBy(desc(productBatches.createdAt))
      .limit(100);
  }),

  addBatch: protectedProcedure
    .input(z.object({
      variantId: z.number(),
      batchNo: z.string().min(1, "Nomor batch wajib diisi"),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
      qty: z.number().int().min(1),
      costPrice: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ input }: { input: { variantId: number; batchNo: string; expiryDate: string; qty: number; costPrice: number } }) => {
      const [batch] = await db.insert(productBatches).values({
        variantId: input.variantId,
        batchNo: input.batchNo.trim(),
        expiryDate: input.expiryDate,
        qty: input.qty,
        costPrice: input.costPrice,
      }).returning({ id: productBatches.id });
      return batch;
    }),
});
