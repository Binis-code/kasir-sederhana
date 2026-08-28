import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { suppliers, purchases } from "../../drizzle/schema.js";
import { eq, desc, like, or, sql, and } from "drizzle-orm";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1).max(128),
  phone: z.string().max(32).optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const suppliersRouter = router({
  list: protectedProcedure
    .input(z.object({ q: z.string().optional(), activeOnly: z.boolean().default(true), limit: z.number().int().min(1).max(200).default(100), offset: z.number().int().min(0).default(0) }))
    .query(async ({ input }) => {
      const where = [];
      if (input.activeOnly) where.push(eq(suppliers.isActive, true));
      if (input.q) {
        const q = `%${input.q}%`;
        where.push(or(like(suppliers.name, q), like(suppliers.phone, q), like(suppliers.address, q)));
      }
      const items = await db.select().from(suppliers).where(where.length ? and(...where) : undefined).orderBy(desc(suppliers.createdAt)).limit(input.limit).offset(input.offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(suppliers).where(where.length ? and(...where) : undefined);
      return { items, total: Number(count) };
    }),

  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const [s] = await db.select().from(suppliers).where(eq(suppliers.id, input.id)).limit(1);
    if (!s) throw new Error("Pemasok tidak ditemukan");
    return s;
  }),

  create: adminProcedure.input(supplierSchema).mutation(async ({ input }) => {
    const [s] = await db.insert(suppliers).values(input).returning({ id: suppliers.id });
    return { id: s.id };
  }),

  update: adminProcedure.input(supplierSchema.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.update(suppliers).set(data).where(eq(suppliers.id, id));
    return { ok: true };
  }),

  delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(purchases).where(eq(purchases.supplierId, input.id));
    if (Number(c) > 0) {
      throw new Error("Pemasok punya riwayat pembelian — arsipkan (set nonaktif) alih-alih menghapus");
    }
    await db.delete(suppliers).where(eq(suppliers.id, input.id));
    return { ok: true };
  }),
});


