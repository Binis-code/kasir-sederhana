import { router, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { sales, saleItems, productVariants, products, receivables, cashEntries, purchases, stockOpnames } from "../../drizzle/schema.js";
import { sql, and, eq, ne, lte, gte, inArray, or, isNull, asc, desc } from "drizzle-orm";

export const dashboardRouter = router({
  summary: protectedProcedure.query(async () => {
    const today = sql`CURDATE()`;

    const [todayRow] = await db.select({
      totalSales: sql<number>`COALESCE(SUM(${sales.total}),0)`,
      trxCount: sql<number>`count(*)`,
    }).from(sales).where(and(sql`DATE(${sales.createdAt}) = ${today}`, eq(sales.status, "completed")));

    const [invRow] = await db.select({
      inventoryValue: sql<number>`COALESCE(SUM(${productVariants.stock} * ${productVariants.costPrice}),0)`,
    }).from(productVariants).where(eq(productVariants.isActive, true));

    const [recvRow] = await db.select({
      outstanding: sql<number>`COALESCE(SUM(${receivables.amount} - ${receivables.paidAmount}),0)`,
    }).from(receivables).where(ne(receivables.status, "paid"));

    const monthStart = sql`DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    const [cashRow] = await db.select({
      income: sql<number>`COALESCE(SUM(CASE WHEN ${cashEntries.type}='income' THEN ${cashEntries.amount} ELSE 0 END),0)`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${cashEntries.type}='expense' THEN ${cashEntries.amount} ELSE 0 END),0)`,
    }).from(cashEntries).where(gte(cashEntries.entryDate, monthStart));

    const weekly = await db.select({
      day: sql<string>`DATE_FORMAT(${sales.createdAt}, '%Y-%m-%d')`,
      total: sql<number>`COALESCE(SUM(${sales.total}),0)`,
    }).from(sales)
      .where(and(gte(sales.createdAt, sql`DATE_SUB(CURDATE(), INTERVAL 6 DAY)`), eq(sales.status, "completed")))
      .groupBy(sql`DATE_FORMAT(${sales.createdAt}, '%Y-%m-%d')`)
      .orderBy(sql`DATE_FORMAT(${sales.createdAt}, '%Y-%m-%d')`);

    const lowStock = await db.select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      minStock: products.minStock,
    }).from(products)
      .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.minStock}`))
      .orderBy(sql`${products.stock} / GREATEST(${products.minStock},1) ASC`)
      .limit(8);

    const dueReceivables = await db.select({
      id: receivables.id,
      customerName: receivables.customerName,
      amount: sql<number>`${receivables.amount} - ${receivables.paidAmount}`,
      dueDate: receivables.dueDate,
    }).from(receivables)
      .where(and(ne(receivables.status, "paid"), lte(receivables.dueDate, sql`CURDATE()`)))
      .orderBy(asc(receivables.dueDate))
      .limit(8);

    const pendingPurchases = await db.select({
      id: purchases.id,
      invoiceNo: purchases.invoiceNo,
      status: purchases.status,
    }).from(purchases).where(inArray(purchases.status, ["ordered", "partial"])).orderBy(desc(purchases.createdAt)).limit(5);

    const openOpnames = await db.select({
      id: stockOpnames.id,
      code: stockOpnames.code,
      createdAt: stockOpnames.createdAt,
    }).from(stockOpnames).where(eq(stockOpnames.status, "open")).limit(5);

    return {
      todaySales: Number(todayRow?.totalSales ?? 0),
      todayTrx: Number(todayRow?.trxCount ?? 0),
      inventoryValue: Number(invRow.inventoryValue),
      receivableOutstanding: Number(recvRow.outstanding),
      monthOtherIncome: Number(cashRow.income),
      monthExpense: Number(cashRow.expense),
      weekly: weekly.map(w => ({ day: w.day, total: Number(w.total) })),
      attention: {
        lowStock: lowStock.map(l => ({ ...l, stock: Number(l.stock), minStock: Number(l.minStock) })),
        dueReceivables: dueReceivables.map(r => ({ ...r, amount: Number(r.amount) })),
        pendingPurchases,
        openOpnames,
      },
    };
  }),

  lowStockCount: protectedProcedure.query(async () => {
    const [row] = await db.select({ c: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.minStock}`));
    return Number(row.c);
  }),

  overdueReceivableCount: protectedProcedure.query(async () => {
    const [row] = await db.select({ c: sql<number>`count(*)` })
      .from(receivables)
      .where(and(ne(receivables.status, "paid"), lte(receivables.dueDate, sql`CURDATE()`)));
    return Number(row.c);
  }),
});



