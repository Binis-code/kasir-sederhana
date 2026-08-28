import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { outlets, stockTransfers, stockTransferItems, productVariants, inventoryMovements } from "../../drizzle/schema.js";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const outletsRouter = router({
  list: protectedProcedure.query(async () => {
    let rows = await db.select().from(outlets).orderBy(desc(outlets.isMain), outlets.name);
    if (!rows.length) {
      // Seed default main outlet if empty
      await db.insert(outlets).values({
        name: "Toko Utama (Pusat)",
        code: "PST",
        isMain: true,
        address: "Jl. Merdeka No. 45",
        phone: "081234567890",
      });
      rows = await db.select().from(outlets);
    }
    return rows;
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1, "Nama cabang wajib diisi"),
      code: z.string().min(1, "Kode cabang wajib diisi").toUpperCase(),
      address: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      isMain: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const [created] = await db.insert(outlets).values({
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        isMain: input.isMain ?? false,
      }).returning({ id: outlets.id, name: outlets.name });
      return created;
    }),

  listTransfers: protectedProcedure.query(async () => {
    const rows = await db.select().from(stockTransfers).orderBy(desc(stockTransfers.createdAt)).limit(50);
    const outletList = await db.select().from(outlets);
    const outletMap = new Map(outletList.map((o: typeof outlets.$inferSelect) => [o.id, o]));

    return rows.map((t: typeof stockTransfers.$inferSelect) => ({
      ...t,
      fromOutletName: outletMap.get(t.fromOutletId)?.name ?? `Cabang #${t.fromOutletId}`,
      toOutletName: outletMap.get(t.toOutletId)?.name ?? `Cabang #${t.toOutletId}`,
    }));
  }),

  createTransfer: protectedProcedure
    .input(z.object({
      fromOutletId: z.number(),
      toOutletId: z.number(),
      notes: z.string().optional().nullable(),
      items: z.array(z.object({
        variantId: z.number(),
        qty: z.number().int().min(1),
      })).min(1, "Minimal 1 item untuk transfer"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.fromOutletId === input.toOutletId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cabang asal dan tujuan tidak boleh sama" });
      }
      const transferNo = `TRF-${Date.now().toString().slice(-6)}`;

      const [trf] = await db.insert(stockTransfers).values({
        transferNo,
        fromOutletId: input.fromOutletId,
        toOutletId: input.toOutletId,
        notes: input.notes?.trim() || null,
        status: "pending",
        createdBy: ctx.user.id,
      }).returning({ id: stockTransfers.id, transferNo: stockTransfers.transferNo });

      for (const item of input.items) {
        await db.insert(stockTransferItems).values({
          transferId: trf.id,
          variantId: item.variantId,
          qty: item.qty,
        });
      }

      return trf;
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      transferId: z.number(),
      status: z.enum(["in_transit", "completed", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const [transfer] = await db.select().from(stockTransfers).where(eq(stockTransfers.id, input.transferId));
      if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Transfer tidak ditemukan" });

      if (input.status === "completed") {
        // Record inventory movements for transfer
        const items = await db.select().from(stockTransferItems).where(eq(stockTransferItems.transferId, input.transferId));
        for (const it of items) {
          const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, it.variantId));
          if (variant) {
            await db.insert(inventoryMovements).values({
              productId: variant.productId,
              variantId: it.variantId,
              type: "adjustment",
              qty: -it.qty,
              refType: "transfer",
              note: `Transfer ${transfer.transferNo} ke Cabang #${transfer.toOutletId}`,
              createdBy: ctx.user.id,
            });
          }
        }
      }

      await db.update(stockTransfers)
        .set({
          status: input.status,
          receivedBy: input.status === "completed" ? ctx.user.id : transfer.receivedBy,
          receivedAt: input.status === "completed" ? new Date() : transfer.receivedAt,
          updatedAt: new Date(),
        })
        .where(eq(stockTransfers.id, input.transferId));

      return { success: true };
    }),
});
