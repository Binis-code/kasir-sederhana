import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { receivables, receivablePayments, sales } from "../../drizzle/schema.js";
import { eq, sql, and, asc, desc, lte, ne } from "drizzle-orm";
import { z } from "zod";

export const receivablesRouter = router({
  list: protectedProcedure.input(z.object({
    status: z.enum(["open", "partial", "paid"]).optional(),
    overdueOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  })).query(async ({ input }) => {
    const where = [];
    if (input.status) where.push(eq(receivables.status, input.status));
    if (input.overdueOnly) where.push(and(ne(receivables.status, "paid"), lte(receivables.dueDate, sql`CURDATE()`)));
    const items = await db.select({
      id: receivables.id,
      customerName: receivables.customerName,
      amount: receivables.amount,
      paidAmount: receivables.paidAmount,
      dueDate: receivables.dueDate,
      status: receivables.status,
      saleId: receivables.saleId,
      invoiceNo: sales.invoiceNo,
      createdAt: receivables.createdAt,
    }).from(receivables)
      .innerJoin(sales, eq(sales.id, receivables.saleId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(receivables.dueDate), desc(receivables.createdAt))
      .limit(input.limit);
    return items;
  }),

  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const [r] = await db.select({
      id: receivables.id,
      customerName: receivables.customerName,
      amount: receivables.amount,
      paidAmount: receivables.paidAmount,
      dueDate: receivables.dueDate,
      status: receivables.status,
      saleId: receivables.saleId,
      invoiceNo: sales.invoiceNo,
      saleTotal: sales.total,
      createdAt: receivables.createdAt,
    }).from(receivables).innerJoin(sales, eq(sales.id, receivables.saleId)).where(eq(receivables.id, input.id)).limit(1);
    if (!r) throw new Error("Piutang tidak ditemukan");
    const payments = await db.select({
      id: receivablePayments.id,
      amount: receivablePayments.amount,
      note: receivablePayments.note,
      createdAt: receivablePayments.createdAt,
      userName: sql<string>`(SELECT name FROM users WHERE users.id = ${receivablePayments.createdBy})`,
    }).from(receivablePayments).where(eq(receivablePayments.receivableId, r.id)).orderBy(desc(receivablePayments.createdAt));
    return { ...r, payments };
  }),

  pay: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    amount: z.number().int().min(1),
    note: z.string().max(300).optional().nullable(),
  })).mutation(async ({ input, ctx }) => {
    return db.transaction(async (tx) => {
      const [r] = await tx.select().from(receivables).where(eq(receivables.id, input.id)).for("update");
      if (!r) throw new Error("Piutang tidak ditemukan");
      if (r.status === "paid") throw new Error("Piutang sudah lunas");
      const remaining = r.amount - r.paidAmount;
      if (input.amount > remaining) throw new Error(`Melebihi sisa piutang (sisa ${remaining})`);
      const newPaid = r.paidAmount + input.amount;
      const status = newPaid >= r.amount ? "paid" : "partial";
      await tx.update(receivables).set({ paidAmount: newPaid, status }).where(eq(receivables.id, r.id));
      await tx.insert(receivablePayments).values({
        receivableId: r.id,
        amount: input.amount,
        note: input.note ?? null,
        createdBy: ctx.user.id,
      });
      return { ok: true, status, remaining: r.amount - newPaid };
    });
  }),
});



