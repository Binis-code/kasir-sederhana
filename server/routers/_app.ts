import { router } from "../trpc/index.js";
import { authRouter } from "./auth.js";
import { usersRouter } from "./users.js";
import { productsRouter } from "./products.js";
import { suppliersRouter } from "./suppliers.js";
import { purchasesRouter } from "./purchases.js";
import { posRouter } from "./pos.js";
import { inventoryRouter } from "./inventory.js";
import { receivablesRouter } from "./receivables.js";
import { financeRouter } from "./finance.js";
import { reportsRouter } from "./reports.js";
import { dashboardRouter } from "./dashboard.js";
import { notificationsRouter } from "./notifications.js";
import { discountsRouter } from "./discounts.js";
import { shiftsRouter } from "./shifts.js";
import { backupRouter } from "./backup.js";
import { outletsRouter } from "./outlets.js";
import { analyticsRouter } from "./analytics.js";
import { toolsRouter } from "./tools.js";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  products: productsRouter,
  suppliers: suppliersRouter,
  purchases: purchasesRouter,
  pos: posRouter,
  inventory: inventoryRouter,
  receivables: receivablesRouter,
  finance: financeRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
  notifications: notificationsRouter,
  discounts: discountsRouter,
  shifts: shiftsRouter,
  backup: backupRouter,
  outlets: outletsRouter,
  analytics: analyticsRouter,
  tools: toolsRouter,
});

export type AppRouter = typeof appRouter;
