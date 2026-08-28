import { router, protectedProcedure, adminProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { cashierShifts, sales, salePayments, cashEntries, users } from "../../drizzle/schema.js";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";

export const shiftsRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    const [shift] = await db.select()
      .from(cashierShifts)
      .where(and(eq(cashierShifts.cashierId, ctx.user.id), eq(cashierShifts.status, "open")))
      .orderBy(desc(cashierShifts.openedAt))
      .limit(1);
    return shift ?? null;
  }),

  open: protectedProcedure.input(z.object({
    startingCash: z.number().int().min(0).default(0),
    notes: z.string().max(300).optional().nullable(),
  })).mutation(async ({ input, ctx }) => {
    const [active] = await db.select()
      .from(cashierShifts)
      .where(and(eq(cashierShifts.cashierId, ctx.user.id), eq(cashierShifts.status, "open")))
      .limit(1);
    if (active) throw new Error("Shift Anda saat ini masih aktif.");

    const [newShift] = await db.insert(cashierShifts).values({
      cashierId: ctx.user.id,
      startingCash: input.startingCash,
      notes: input.notes ?? null,
      status: "open",
    }).returning({ id: cashierShifts.id });

    return { id: newShift.id };
  }),

  close: protectedProcedure.input(z.object({
    actualCash: z.number().int().min(0),
    notes: z.string().max(300).optional().nullable(),
  })).mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const [active] = await tx.select()
        .from(cashierShifts)
        .where(and(eq(cashierShifts.cashierId, ctx.user.id), eq(cashierShifts.status, "open")))
        .limit(1);
      if (!active) throw new Error("Tidak ada shift aktif untuk ditutup.");

      const openedAt = active.openedAt;

      // Sum cash payments during this shift
      const [cashSales] = await tx.select({
        total: sql<number>`COALESCE(SUM(${salePayments.amount}), 0)`,
      }).from(salePayments)
        .innerJoin(sales, eq(sales.id, salePayments.saleId))
        .where(and(
          eq(sales.cashierId, ctx.user.id),
          eq(salePayments.method, "cash"),
          gte(sales.createdAt, openedAt)
        ));

      const expectedCash = active.startingCash + Number(cashSales?.total ?? 0);
      const cashDiff = input.actualCash - expectedCash;

      await tx.update(cashierShifts).set({
        closedAt: new Date(),
        expectedCash,
        actualCash: input.actualCash,
        cashDiff,
        notes: input.notes ? `${active.notes ? `${active.notes} | ` : ""}${input.notes}` : active.notes,
        status: "closed",
      }).where(eq(cashierShifts.id, active.id));

      return {
        shiftId: active.id,
        startingCash: active.startingCash,
        cashSales: Number(cashSales?.total ?? 0),
        expectedCash,
        actualCash: input.actualCash,
        cashDiff,
      };
    });
  }),

  list: adminProcedure.input(z.object({
    limit: z.number().int().min(1).max(100).default(50),
  })).query(async ({ input }) => {
    return db.select({
      id: cashierShifts.id,
      cashierId: cashierShifts.cashierId,
      cashierName: users.name,
      openedAt: cashierShifts.openedAt,
      closedAt: cashierShifts.closedAt,
      startingCash: cashierShifts.startingCash,
      expectedCash: cashierShifts.expectedCash,
      actualCash: cashierShifts.actualCash,
      cashDiff: cashierShifts.cashDiff,
      notes: cashierShifts.notes,
      status: cashierShifts.status,
    }).from(cashierShifts)
      .innerJoin(users, eq(users.id, cashierShifts.cashierId))
      .orderBy(desc(cashierShifts.openedAt))
      .limit(input.limit);
  }),
});
