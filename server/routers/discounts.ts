import { router, adminProcedure, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { discountRules, vouchers } from "../../drizzle/schema.js";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const ruleSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(["fixed", "percentage"]),
  value: z.number().int().min(0),
  minPurchase: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

const voucherSchema = ruleSchema.extend({
  code: z.string().min(2).max(64),
  maxDiscount: z.number().int().min(0).optional().nullable(),
  validFrom: z.string().min(8),
  validUntil: z.string().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
});

export const discountsRouter = router({
  listRules: protectedProcedure.query(() => db.select().from(discountRules).orderBy(desc(discountRules.createdAt)).limit(100)),
  createRule: adminProcedure.input(ruleSchema).mutation(async ({ input }) => {
    const [r] = await db.insert(discountRules).values(input).returning({ id: discountRules.id });
    return { id: r.id };
  }),
  updateRule: adminProcedure.input(ruleSchema.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.update(discountRules).set(data).where(eq(discountRules.id, id));
    return { ok: true };
  }),

  listVouchers: protectedProcedure.query(() => db.select().from(vouchers).orderBy(desc(vouchers.createdAt)).limit(100)),
  createVoucher: adminProcedure.input(voucherSchema).mutation(async ({ input }) => {
    const code = input.code.toUpperCase();
    const dup = await db.select({ id: vouchers.id }).from(vouchers).where(eq(vouchers.code, code)).limit(1);
    if (dup.length) throw new Error("Kode voucher sudah ada");
    const [v] = await db.insert(vouchers).values({ ...input, code }).returning({ id: vouchers.id });
    return { id: v.id };
  }),
  updateVoucher: adminProcedure.input(voucherSchema.partial().extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    if (data.code) data.code = data.code.toUpperCase();
    await db.update(vouchers).set(data).where(eq(vouchers.id, id));
    return { ok: true };
  }),
});
