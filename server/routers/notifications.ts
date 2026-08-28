import { router, protectedProcedure } from "../trpc/index.js";
import { db } from "../db.js";
import { products, receivables } from "../../drizzle/schema.js";
import { sql, and, eq, ne, lte, asc } from "drizzle-orm";

export const notificationsRouter = router({
  feed: protectedProcedure.query(async () => {
    const lowStock = await db.select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      minStock: products.minStock,
    }).from(products)
      .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.minStock}`))
      .orderBy(asc(products.stock)).limit(10);

    const dueReceivables = await db.select({
      id: receivables.id,
      customerName: receivables.customerName,
      amount: sql<number>`${receivables.amount} - ${receivables.paidAmount}`,
      dueDate: receivables.dueDate,
    }).from(receivables)
      .where(and(ne(receivables.status, "paid"), lte(receivables.dueDate, sql`date('now')`)))
      .orderBy(asc(receivables.dueDate)).limit(10);

    return {
      lowStock: lowStock.map(l => ({ ...l, stock: Number(l.stock), minStock: Number(l.minStock) })),
      dueReceivables: dueReceivables.map(r => ({ ...r, amount: Number(r.amount) })),
      total: lowStock.length + dueReceivables.length,
    };
  }),
});
