import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  date,
  uniqueIndex,
  index,
  primaryKey,
  serial,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  openId: varchar("open_id", { length: 128 }).unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 128 }),
  passwordHash: varchar("password_hash", { length: 256 }).notNull(),
  role: varchar("role", { length: 16 }).notNull().default("kasir"),
  loginMethod: varchar("login_method", { length: 32 }).notNull().default("password"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  roleIdx: index("users_role_idx").on(t.role),
}));

export const suppliers = mysqlTable("suppliers", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 128 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const products = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 128 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  barcode: varchar("barcode", { length: 64 }),
  stock: int("stock").notNull().default(0),
  minStock: int("min_stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  barcodeIdx: uniqueIndex("products_barcode_idx").on(t.barcode),
  categoryIdx: index("products_category_idx").on(t.category),
  lowStockIdx: index("products_low_stock_idx").on(t.stock, t.minStock, t.isActive),
}));

export const productVariants = mysqlTable("product_variants", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 64 }).notNull(),
  barcode: varchar("barcode", { length: 64 }),
  sellingPrice: int("selling_price").notNull().default(0),
  costPrice: int("cost_price").notNull().default(0),
  stock: int("stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  barcodeIdx: uniqueIndex("variants_barcode_idx").on(t.barcode),
  productIdx: index("variants_product_idx").on(t.productId),
  stockIdx: index("variants_stock_idx").on(t.stock, t.isActive),
}));

export const purchases = mysqlTable("purchases", {
  id: int("id").primaryKey().autoincrement(),
  supplierId: int("supplier_id").notNull().references(() => suppliers.id),
  invoiceNo: varchar("invoice_no", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  totalCost: int("total_cost").notNull().default(0),
  notes: text("notes"),
  expectedAt: date("expected_at", { mode: "string" }),
  createdBy: int("created_by").notNull().references(() => users.id),
  receivedBy: int("received_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  receivedAt: timestamp("received_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  supplierIdx: index("purchases_supplier_idx").on(t.supplierId),
  statusIdx: index("purchases_status_idx").on(t.status),
  invoiceIdx: uniqueIndex("purchases_invoice_idx").on(t.invoiceNo),
  dateIdx: index("purchases_date_idx").on(t.createdAt),
}));

export const purchaseItems = mysqlTable("purchase_items", {
  id: int("id").primaryKey().autoincrement(),
  purchaseId: int("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  variantId: int("variant_id").notNull().references(() => productVariants.id),
  qtyOrdered: int("qty_ordered").notNull(),
  qtyReceived: int("qty_received").notNull().default(0),
  unitCost: int("unit_cost").notNull(),
}, (t) => ({
  purchaseIdx: index("purchase_items_purchase_idx").on(t.purchaseId),
  variantIdx: index("purchase_items_variant_idx").on(t.variantId),
}));

export const sales = mysqlTable("sales", {
  id: int("id").primaryKey().autoincrement(),
  invoiceNo: varchar("invoice_no", { length: 64 }).notNull().unique(),
  cashierId: int("cashier_id").notNull().references(() => users.id),
  subtotal: int("subtotal").notNull(),
  discountTotal: int("discount_total").notNull().default(0),
  voucherCode: varchar("voucher_code", { length: 64 }),
  voucherDiscount: int("voucher_discount").notNull().default(0),
  total: int("total").notNull(),
  paymentMethod: varchar("payment_method", { length: 16 }).notNull(),
  paidAmount: int("paid_amount").notNull(),
  changeAmount: int("change_amount").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("completed"),
  customerName: varchar("customer_name", { length: 128 }),
  dueDate: date("due_date", { mode: "string" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  cashierIdx: index("sales_cashier_idx").on(t.cashierId),
  dateIdx: index("sales_date_idx").on(t.createdAt),
  invoiceIdx: uniqueIndex("sales_invoice_idx").on(t.invoiceNo),
  statusIdx: index("sales_status_idx").on(t.status),
  dueDateIdx: index("sales_due_date_idx").on(t.dueDate),
}));

export const saleItems = mysqlTable("sale_items", {
  id: int("id").primaryKey().autoincrement(),
  saleId: int("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: int("product_id").notNull().references(() => products.id),
  variantId: int("variant_id").notNull().references(() => productVariants.id),
  name: varchar("name", { length: 128 }).notNull(),
  qty: int("qty").notNull(),
  unitPrice: int("unit_price").notNull(),
  discount: int("discount").notNull().default(0),
  lineTotal: int("line_total").notNull(),
}, (t) => ({
  saleIdx: index("sale_items_sale_idx").on(t.saleId),
  productIdx: index("sale_items_product_idx").on(t.productId),
  variantIdx: index("sale_items_variant_idx").on(t.variantId),
}));

export const salePayments = mysqlTable("sale_payments", {
  id: int("id").primaryKey().autoincrement(),
  saleId: int("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  method: varchar("method", { length: 16 }).notNull(),
  amount: int("amount").notNull(),
  referenceNo: varchar("reference_no", { length: 64 }),
}, (t) => ({
  saleIdx: index("sale_payments_sale_idx").on(t.saleId),
}));

export const receivables = mysqlTable("receivables", {
  id: int("id").primaryKey().autoincrement(),
  saleId: int("sale_id").notNull().unique().references(() => sales.id, { onDelete: "cascade" }),
  customerName: varchar("customer_name", { length: 128 }).notNull(),
  amount: int("amount").notNull(),
  paidAmount: int("paid_amount").notNull().default(0),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  statusIdx: index("receivables_status_idx").on(t.status),
  dueDateIdx: index("receivables_due_idx").on(t.dueDate, t.status),
  customerIdx: index("receivables_customer_idx").on(t.customerName),
}));

export const receivablePayments = mysqlTable("receivable_payments", {
  id: int("id").primaryKey().autoincrement(),
  receivableId: int("receivable_id").notNull().references(() => receivables.id, { onDelete: "cascade" }),
  amount: int("amount").notNull(),
  note: text("note"),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  receivableIdx: index("receivable_payments_receivable_idx").on(t.receivableId),
}));

export const inventoryMovements = mysqlTable("inventory_movements", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("product_id").notNull().references(() => products.id),
  variantId: int("variant_id").references(() => productVariants.id),
  type: varchar("type", { length: 16 }).notNull(),
  qty: int("qty").notNull(),
  refType: varchar("ref_type", { length: 32 }),
  refId: int("ref_id"),
  note: text("note"),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  productIdx: index("movements_product_idx").on(t.productId),
  variantIdx: index("movements_variant_idx").on(t.variantId),
  typeIdx: index("movements_type_idx").on(t.type),
  refIdx: index("movements_ref_idx").on(t.refType, t.refId),
  dateIdx: index("movements_date_idx").on(t.createdAt),
}));

export const stockOpnames = mysqlTable("stock_opnames", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 16 }).notNull().default("open"),
  responsibleName: varchar("responsible_name", { length: 128 }).notNull(),
  responsibleUserId: int("responsible_user_id").references(() => users.id),
  note: text("note"),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  statusIdx: index("opnames_status_idx").on(t.status),
  dateIdx: index("opnames_date_idx").on(t.createdAt),
}));

export const stockOpnameItems = mysqlTable("stock_opname_items", {
  id: int("id").primaryKey().autoincrement(),
  opnameId: int("opname_id").notNull().references(() => stockOpnames.id, { onDelete: "cascade" }),
  variantId: int("variant_id").notNull().references(() => productVariants.id),
  systemStock: int("system_stock").notNull(),
  physicalStock: int("physical_stock").notNull(),
  diff: int("diff").notNull(),
  reason: varchar("reason", { length: 128 }),
}, (t) => ({
  opnameIdx: index("opname_items_opname_idx").on(t.opnameId),
  variantIdx: index("opname_items_variant_idx").on(t.variantId),
}));

export const cashEntries = mysqlTable("cash_entries", {
  id: int("id").primaryKey().autoincrement(),
  type: varchar("type", { length: 16 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(),
  description: varchar("description", { length: 256 }).notNull(),
  amount: int("amount").notNull(),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  createdBy: int("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  typeIdx: index("cash_type_idx").on(t.type),
  dateIdx: index("cash_date_idx").on(t.entryDate),
  categoryIdx: index("cash_category_idx").on(t.category),
}));

export const discountRules = mysqlTable("discount_rules", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 64 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  value: int("value").notNull(),
  minPurchase: int("min_purchase").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: date("starts_at", { mode: "string" }),
  endsAt: date("ends_at", { mode: "string" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const vouchers = mysqlTable("vouchers", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  type: varchar("type", { length: 16 }).notNull(),
  value: int("value").notNull(),
  minPurchase: int("min_purchase").notNull().default(0),
  maxDiscount: int("max_discount"),
  validFrom: date("valid_from", { mode: "string" }).notNull(),
  validUntil: date("valid_until", { mode: "string" }),
  usageLimit: int("usage_limit"),
  usedCount: int("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  codeIdx: uniqueIndex("vouchers_code_idx").on(t.code),
  activeIdx: index("vouchers_active_idx").on(t.isActive, t.validFrom, t.validUntil),
}));

export const searchFrequency = mysqlTable("search_frequency", {
  skuKey: varchar("sku_key", { length: 128 }).primaryKey(),
  count: int("count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales, { relationName: "cashier" }),
  purchasesCreated: many(purchases, { relationName: "creator" }),
  purchasesReceived: many(purchases, { relationName: "receiver" }),
  movements: many(inventoryMovements),
  cashEntries: many(cashEntries),
  receivablePayments: many(receivablePayments),
}));

export const productsRelations = relations(products, ({ many, one }) => ({
  variants: many(productVariants),
  saleItems: many(saleItems),
  movements: many(inventoryMovements),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  purchaseItems: many(purchaseItems),
  saleItems: many(saleItems),
  opnameItems: many(stockOpnameItems),
  movements: many(inventoryMovements),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchases: many(purchases),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchases.supplierId], references: [suppliers.id] }),
  creator: one(users, { fields: [purchases.createdBy], references: [users.id], relationName: "creator" }),
  receiver: one(users, { fields: [purchases.receivedBy], references: [users.id], relationName: "receiver" }),
  items: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, { fields: [purchaseItems.purchaseId], references: [purchases.id] }),
  variant: one(productVariants, { fields: [purchaseItems.variantId], references: [productVariants.id] }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  cashier: one(users, { fields: [sales.cashierId], references: [users.id], relationName: "cashier" }),
  items: many(saleItems),
  payments: many(salePayments),
  receivable: one(receivables),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [saleItems.variantId], references: [productVariants.id] }),
}));

export const salePaymentsRelations = relations(salePayments, ({ one }) => ({
  sale: one(sales, { fields: [salePayments.saleId], references: [sales.id] }),
}));

export const receivablesRelations = relations(receivables, ({ one, many }) => ({
  sale: one(sales, { fields: [receivables.saleId], references: [sales.id] }),
  payments: many(receivablePayments),
}));

export const receivablePaymentsRelations = relations(receivablePayments, ({ one }) => ({
  receivable: one(receivables, { fields: [receivablePayments.receivableId], references: [receivables.id] }),
  creator: one(users, { fields: [receivablePayments.createdBy], references: [users.id] }),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  product: one(products, { fields: [inventoryMovements.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [inventoryMovements.variantId], references: [productVariants.id] }),
  creator: one(users, { fields: [inventoryMovements.createdBy], references: [users.id] }),
}));

export const stockOpnamesRelations = relations(stockOpnames, ({ one, many }) => ({
  responsibleUser: one(users, { fields: [stockOpnames.responsibleUserId], references: [users.id] }),
  items: many(stockOpnameItems),
}));

export const stockOpnameItemsRelations = relations(stockOpnameItems, ({ one }) => ({
  opname: one(stockOpnames, { fields: [stockOpnameItems.opnameId], references: [stockOpnames.id] }),
  variant: one(productVariants, { fields: [stockOpnameItems.variantId], references: [productVariants.id] }),
}));

export const cashEntriesRelations = relations(cashEntries, ({ one }) => ({
  creator: one(users, { fields: [cashEntries.createdBy], references: [users.id] }),
}));

