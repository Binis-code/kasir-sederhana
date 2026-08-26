import { router, adminProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { sales, saleItems, productVariants, cashEntries, receivables } from "../../drizzle/schema.js";
import { sql, and, gte, lte, desc, eq } from "drizzle-orm";
import { z } from "zod";

const rangeSchema = z.object({
  from: z.string().min(8),
  to: z.string().min(8),
});

export const reportsRouter = router({
  salesSummary: adminProcedure.input(rangeSchema).query(async ({ input }) => {
    const where = and(
      gte(sales.createdAt, new Date(`${input.from}T00:00:00`)),
      lte(sales.createdAt, new Date(`${input.to}T23:59:59`)),
      eq(sales.status, "completed")
    );
    const [row] = await db.select({
      totalSales: sql<number>`COALESCE(SUM(${sales.total}),0)`,
      trxCount: sql<number>`count(*)`,
      totalDiscount: sql<number>`COALESCE(SUM(${sales.discountTotal} + ${sales.voucherDiscount}),0)`,
    }).from(sales).where(where);
    const byMethod = await db.select({
      method: sales.paymentMethod,
      total: sql<number>`COALESCE(SUM(${sales.total}),0)`,
      count: sql<number>`count(*)`,
    }).from(sales).where(where).groupBy(sales.paymentMethod);
    const daily = await db.select({
      day: sql<string>`DATE_FORMAT(${sales.createdAt}, '%Y-%m-%d')`,
      total: sql<number>`COALESCE(SUM(${sales.total}),0)`,
      count: sql<number>`count(*)`,
    }).from(sales).where(where).groupBy(sql`DATE_FORMAT(${sales.createdAt}, '%Y-%m-%d')`).orderBy(sql`DATE_FORMAT(${sales.createdAt}, '%Y-%m-%d')`);
    return {
      totalSales: Number(row.totalSales),
      trxCount: Number(row.trxCount),
      totalDiscount: Number(row.totalDiscount),
      byMethod: byMethod.map(m => ({ ...m, total: Number(m.total), count: Number(m.count) })),
      daily: daily.map(d => ({ ...d, total: Number(d.total), count: Number(d.count) })),
    };
  }),

  topProducts: adminProcedure.input(rangeSchema.extend({ limit: z.number().int().min(1).max(50).default(10) })).query(async ({ input }) => {
    const rows = await db.select({
      productId: saleItems.productId,
      name: saleItems.name,
      qtySold: sql<number>`SUM(${saleItems.qty})`,
      revenue: sql<number>`SUM(${saleItems.lineTotal})`,
    }).from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(and(
        gte(sales.createdAt, new Date(`${input.from}T00:00:00`)),
        lte(sales.createdAt, new Date(`${input.to}T23:59:59`)),
        eq(sales.status, "completed")
      ))
      .groupBy(saleItems.productId, saleItems.name)
      .orderBy(desc(sql`SUM(${saleItems.qty})`))
      .limit(input.limit);
    return rows.map(r => ({ ...r, qtySold: Number(r.qtySold), revenue: Number(r.revenue) }));
  }),

  basicProfit: adminProcedure.input(rangeSchema).query(async ({ input }) => {
    const where = and(
      gte(sales.createdAt, new Date(`${input.from}T00:00:00`)),
      lte(sales.createdAt, new Date(`${input.to}T23:59:59`)),
      eq(sales.status, "completed")
    );
    // Laba memakai snapshot harga modal SAAT transaksi (cost_price_at_sale);
    // jujur bila data modal belum lengkap (snapshot 0).
    const [rev] = await db.select({
      revenue: sql<number>`COALESCE(SUM(${saleItems.lineTotal}),0)`,
      cogs: sql<number>`COALESCE(SUM(${saleItems.qty} * ${saleItems.costPriceAtSale}),0)`,
      missingCost: sql<number>`SUM(CASE WHEN ${saleItems.costPriceAtSale} = 0 THEN 1 ELSE 0 END)`,
    }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId)).where(where);
    const [exp] = await db.select({
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${cashEntries.type}='expense' THEN ${cashEntries.amount} ELSE 0 END),0)`,
      otherIncome: sql<number>`COALESCE(SUM(CASE WHEN ${cashEntries.type}='income' THEN ${cashEntries.amount} ELSE 0 END),0)`,
    }).from(cashEntries).where(and(gte(cashEntries.entryDate, input.from), lte(cashEntries.entryDate, input.to)));
    const revenue = Number(rev.revenue);
    const cogs = Number(rev.cogs);
    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      otherIncome: Number(exp.otherIncome),
      expense: Number(exp.expense),
      netEstimate: revenue - cogs + Number(exp.otherIncome) - Number(exp.expense),
      hasMissingCost: Number(rev.missingCost) > 0,
    };
  }),

  receivablesSummary: adminProcedure.query(async () => {
    const [row] = await db.select({
      outstanding: sql<number>`COALESCE(SUM(${receivables.amount} - ${receivables.paidAmount}),0)`,
      openCount: sql<number>`SUM(CASE WHEN ${receivables.status} != 'paid' THEN 1 ELSE 0 END)`,
      overdueCount: sql<number>`SUM(CASE WHEN ${receivables.status} != 'paid' AND ${receivables.dueDate} < CURDATE() THEN 1 ELSE 0 END)`,
    }).from(receivables);
    return {
      outstanding: Number(row.outstanding),
      openCount: Number(row.openCount),
      overdueCount: Number(row.overdueCount),
    };
  }),
});



