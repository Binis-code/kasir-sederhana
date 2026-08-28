import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { products, productVariants, inventoryMovements } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";

export const toolsRouter = router({
  bulkImportProducts: adminProcedure
    .input(z.object({
      items: z.array(z.object({
        name: z.string().min(1),
        category: z.string().default("Umum"),
        barcode: z.string().optional().nullable(),
        variantLabel: z.string().default("Standar"),
        sellingPrice: z.number().int().min(0),
        costPrice: z.number().int().min(0).default(0),
        stock: z.number().int().min(0).default(0),
        minStock: z.number().int().min(0).default(5),
      })).min(1, "Minimal 1 item diimport"),
    }))
    .mutation(async ({ ctx, input }: { ctx: { user: { id: number } }; input: { items: Array<{ name: string; category: string; barcode?: string | null; variantLabel: string; sellingPrice: number; costPrice: number; stock: number; minStock: number }> } }) => {
      let importedCount = 0;

      for (const it of input.items) {
        // Insert product
        const [prod] = await db.insert(products).values({
          name: it.name.trim(),
          category: it.category.trim() || "Umum",
          barcode: it.barcode?.trim() || null,
          stock: it.stock,
          minStock: it.minStock,
          isActive: true,
        }).returning({ id: products.id });

        // Insert variant
        const [variant] = await db.insert(productVariants).values({
          productId: prod.id,
          label: it.variantLabel.trim() || "Standar",
          barcode: it.barcode?.trim() || null,
          sellingPrice: it.sellingPrice,
          costPrice: it.costPrice,
          stock: it.stock,
          isActive: true,
        }).returning({ id: productVariants.id });

        if (it.stock > 0) {
          await db.insert(inventoryMovements).values({
            productId: prod.id,
            variantId: variant.id,
            type: "adjustment",
            qty: it.stock,
            refType: "import",
            note: "Saldo awal import massal",
            createdBy: ctx.user.id,
          });
        }

        importedCount++;
      }

      return { count: importedCount };
    }),

  barcodeCatalog: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
    }).optional())
    .query(async () => {
      const rows = await db
        .select({
          variantId: productVariants.id,
          productName: products.name,
          category: products.category,
          variantLabel: productVariants.label,
          barcode: productVariants.barcode,
          sellingPrice: productVariants.sellingPrice,
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(productVariants.isActive, true));

      return rows.map((r: typeof rows[0]) => ({
        ...r,
        displayBarcode: r.barcode || `899${r.variantId.toString().padStart(9, "0")}`,
      }));
    }),
});
