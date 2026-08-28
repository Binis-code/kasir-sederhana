import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { cashEntries, users } from "../../drizzle/schema.js";
import { eq, sql, and, desc, gte, lte } from "drizzle-orm";
import { z } from "zod";

const entrySchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1).max(64),
  description: z.string().min(1).max(256),
  amount: z.number().int().min(1),
  entryDate: z.string().min(8).max(10),
});

export const financeRouter = router({
  listEntries: protectedProcedure.input(z.object({
    type: z.enum(["income", "expense"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  })).query(async ({ input }) => {
    const where = [];
    if (input.type) where.push(eq(cashEntries.type, input.type));
    if (input.from) where.push(gte(cashEntries.entryDate, input.from));
    if (input.to) where.push(lte(cashEntries.entryDate, input.to));
    const items = await db.select({
      id: cashEntries.id,
      type: cashEntries.type,
      category: cashEntries.category,
      description: cashEntries.description,
      amount: cashEntries.amount,
      entryDate: cashEntries.entryDate,
      createdAt: cashEntries.createdAt,
      userName: sql<string>`(SELECT name FROM users WHERE users.id = ${cashEntries.createdBy})`,
    }).from(cashEntries).where(where.length ? and(...where) : undefined).orderBy(desc(cashEntries.entryDate), desc(cashEntries.id)).limit(input.limit);
    return items;
  }),

  createEntry: adminProcedure.input(entrySchema).mutation(async ({ input, ctx }) => {
    const [e] = await db.insert(cashEntries).values({ ...input, createdBy: ctx.user.id }).returning({ id: cashEntries.id });
    return { id: e.id };
  }),

  deleteEntry: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.delete(cashEntries).where(eq(cashEntries.id, input.id));
    return { ok: true };
  }),
});
