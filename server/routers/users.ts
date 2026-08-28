import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { users, sales, purchases, inventoryMovements, cashEntries, receivablePayments } from "../../drizzle/schema.js";
import { eq, desc, like, or, sql, and } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, revokeUserTokens } from "../auth.js";

const userCreateSchema = z.object({
  username: z.string().min(3).max(64),
  name: z.string().min(1).max(128),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).max(128),
  role: z.enum(["owner", "admin", "kasir"]).default("kasir"),
});

const userUpdateSchema = userCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

export const usersRouter = router({
  list: adminProcedure
    .input(z.object({ q: z.string().optional(), role: z.enum(["owner", "admin", "kasir"]).optional(), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) }))
    .query(async ({ input }) => {
      const where = [];
      if (input.q) where.push(or(like(users.username, `%${input.q}%`), like(users.name, `%${input.q}%`), like(users.email, `%${input.q}%`)));
      if (input.role) where.push(eq(users.role, input.role));
      const items = await db.select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        loginMethod: users.loginMethod,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      }).from(users).where(where.length ? and(...where) : undefined).orderBy(desc(users.createdAt)).limit(input.limit).offset(input.offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users).where(where.length ? and(...where) : undefined);
      return { items, total: Number(count) };
    }),

  get: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const [u] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
    if (!u) throw new Error("User tidak ditemukan");
    return u;
  }),

  create: adminProcedure.input(userCreateSchema).mutation(async ({ input }) => {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).limit(1);
    if (existing.length) throw new Error("Username sudah dipakai");
    const passwordHash = await hashPassword(input.password);
    const [u] = await db.insert(users).values({ ...input, passwordHash }).returning({ id: users.id });
    return { id: u.id };
  }),

  update: adminProcedure.input(userUpdateSchema).mutation(async ({ input, ctx }) => {
    const { id, password, ...data } = input;
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new Error("User tidak ditemukan");
    if (target.role === "owner" && ctx.user.role !== "owner") {
      throw new Error("Hanya owner yang dapat mengubah akun owner");
    }
    if (data.username && data.username !== target.username) {
      const dup = await db.select({ id: users.id }).from(users).where(eq(users.username, data.username)).limit(1);
      if (dup.length) throw new Error("Username sudah dipakai");
    }
    if (data.role && data.role !== target.role && target.role === "owner") {
      const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(users).where(eq(users.role, "owner"));
      if (Number(c) <= 1) throw new Error("Tidak boleh menurunkan satu-satunya owner — angkat owner lain dulu");
    }
    const updates: Record<string, unknown> = { ...data };
    if (password) updates.passwordHash = await hashPassword(password);
    await db.update(users).set(updates).where(eq(users.id, id));
    return { ok: true };
  }),

  delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    if (input.id === ctx.user.id) throw new Error("Tidak bisa menghapus akun sendiri");
    const [target] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
    if (!target) throw new Error("User tidak ditemukan");
    if (target.role === "owner" && ctx.user.role !== "owner") {
      throw new Error("Hanya owner yang dapat menghapus akun owner");
    }
    if (target.role === "owner") {
      const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(users).where(eq(users.role, "owner"));
      if (Number(c) <= 1) throw new Error("Harus ada minimal satu owner — angkat owner lain dulu");
    }
    // User dengan riwayat transaksi tidak boleh dihapus (FK sales/purchases/
    // movements/cash_entries memakai created_by/cashier_id tanpa cascade).
    const [[{ c: sC }], [{ c: pC }], [{ c: mC }], [{ c: eC }], [{ c: rpC }]] = await Promise.all([
      db.select({ c: sql<number>`count(*)` }).from(sales).where(eq(sales.cashierId, input.id)),
      db.select({ c: sql<number>`count(*)` }).from(purchases).where(or(eq(purchases.createdBy, input.id), eq(purchases.receivedBy, input.id))),
      db.select({ c: sql<number>`count(*)` }).from(inventoryMovements).where(eq(inventoryMovements.createdBy, input.id)),
      db.select({ c: sql<number>`count(*)` }).from(cashEntries).where(eq(cashEntries.createdBy, input.id)),
      db.select({ c: sql<number>`count(*)` }).from(receivablePayments).where(eq(receivablePayments.createdBy, input.id)),
    ]);
    if (Number(sC) + Number(pC) + Number(mC) + Number(eC) + Number(rpC) > 0) {
      throw new Error("User punya riwayat transaksi sehingga tidak bisa dihapus. Turunkan perannya & ganti password sebagai penonaktifan.");
    }
    await db.delete(users).where(eq(users.id, input.id));
    return { ok: true };
  }),

  changePassword: protectedProcedure.input(z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(6) })).mutation(async ({ input, ctx }) => {
    const bcrypt = await import("bcryptjs");
    const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!u) throw new Error("User tidak ditemukan");
    const valid = await bcrypt.compare(input.oldPassword, u.passwordHash);
    if (!valid) throw new Error("Password lama salah");
    await db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, ctx.user.id));
    // Ganti password = cabut semua token lama (termasuk sesi ini; user login ulang).
    await revokeUserTokens(ctx.user.id);
    return { ok: true };
  }),
});


