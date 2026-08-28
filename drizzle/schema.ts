import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("open_id").unique(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("kasir"),
  loginMethod: text("login_method").notNull().default("password"),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  roleIdx: index("users_role_idx").on(t.role),
}));

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  barcode: text("barcode"),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  barcodeIdx: uniqueIndex("products_barcode_idx").on(t.barcode),
  categoryIdx: index("products_category_idx").on(t.category),
  lowStockIdx: index("products_low_stock_idx").on(t.stock, t.minStock, t.isActive),
}));

export const productVariants = sqliteTable("product_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  barcode: text("barcode"),
  sellingPrice: integer("selling_price").notNull().default(0),
  costPrice: integer("cost_price").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  barcodeIdx: uniqueIndex("variants_barcode_idx").on(t.barcode),
  productIdx: index("variants_product_idx").on(t.productId),
  stockIdx: index("variants_stock_idx").on(t.stock, t.isActive),
}));

export const priceTiers = sqliteTable("price_tiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  minQty: integer("min_qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  variantQtyIdx: uniqueIndex("price_tiers_var_qty_idx").on(t.variantId, t.minQty),
}));

export const purchases = sqliteTable("purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  invoiceNo: text("invoice_no").notNull().unique(),
  status: text("status").notNull().default("draft"),
  totalCost: integer("total_cost").notNull().default(0),
  notes: text("notes"),
  expectedAt: text("expected_at"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  receivedBy: integer("received_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  supplierIdx: index("purchases_supplier_idx").on(t.supplierId),
  statusIdx: index("purchases_status_idx").on(t.status),
  invoiceIdx: uniqueIndex("purchases_invoice_idx").on(t.invoiceNo),
  dateIdx: index("purchases_date_idx").on(t.createdAt),
}));

export const purchaseItems = sqliteTable("purchase_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => productVariants.id),
  qtyOrdered: integer("qty_ordered").notNull(),
  qtyReceived: integer("qty_received").notNull().default(0),
  unitCost: integer("unit_cost").notNull(),
}, (t) => ({
  purchaseIdx: index("purchase_items_purchase_idx").on(t.purchaseId),
  variantIdx: index("purchase_items_variant_idx").on(t.variantId),
}));

export const sales = sqliteTable("sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNo: text("invoice_no").notNull().unique(),
  cashierId: integer("cashier_id").notNull().references(() => users.id),
  subtotal: integer("subtotal").notNull(),
  discountTotal: integer("discount_total").notNull().default(0),
  voucherCode: text("voucher_code"),
  voucherDiscount: integer("voucher_discount").notNull().default(0),
  total: integer("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paidAmount: integer("paid_amount").notNull(),
  changeAmount: integer("change_amount").notNull().default(0),
  status: text("status").notNull().default("completed"),
  customerName: text("customer_name"),
  dueDate: text("due_date"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  cashierIdx: index("sales_cashier_idx").on(t.cashierId),
  dateIdx: index("sales_date_idx").on(t.createdAt),
  invoiceIdx: uniqueIndex("sales_invoice_idx").on(t.invoiceNo),
  statusIdx: index("sales_status_idx").on(t.status),
  dueDateIdx: index("sales_due_date_idx").on(t.dueDate),
}));

export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  variantId: integer("variant_id").notNull().references(() => productVariants.id),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
  costPriceAtSale: integer("cost_price_at_sale").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  lineTotal: integer("line_total").notNull(),
}, (t) => ({
  saleIdx: index("sale_items_sale_idx").on(t.saleId),
  productIdx: index("sale_items_product_idx").on(t.productId),
  variantIdx: index("sale_items_variant_idx").on(t.variantId),
}));

export const salePayments = sqliteTable("sale_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  amount: integer("amount").notNull(),
  referenceNo: text("reference_no"),
}, (t) => ({
  saleIdx: index("sale_payments_sale_idx").on(t.saleId),
}));

export const receivables = sqliteTable("receivables", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().unique().references(() => sales.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  amount: integer("amount").notNull(),
  paidAmount: integer("paid_amount").notNull().default(0),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  statusIdx: index("receivables_status_idx").on(t.status),
  dueDateIdx: index("receivables_due_idx").on(t.dueDate, t.status),
  customerIdx: index("receivables_customer_idx").on(t.customerName),
}));

export const receivablePayments = sqliteTable("receivable_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receivableId: integer("receivable_id").notNull().references(() => receivables.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  note: text("note"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  receivableIdx: index("receivable_payments_receivable_idx").on(t.receivableId),
}));

export const inventoryMovements = sqliteTable("inventory_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  variantId: integer("variant_id").references(() => productVariants.id),
  type: text("type").notNull(),
  qty: integer("qty").notNull(),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  note: text("note"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  productIdx: index("movements_product_idx").on(t.productId),
  variantIdx: index("movements_variant_idx").on(t.variantId),
  typeIdx: index("movements_type_idx").on(t.type),
  refIdx: index("movements_ref_idx").on(t.refType, t.refId),
  dateIdx: index("movements_date_idx").on(t.createdAt),
}));

export const stockOpnames = sqliteTable("stock_opnames", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("open"),
  responsibleName: text("responsible_name").notNull(),
  responsibleUserId: integer("responsible_user_id").references(() => users.id),
  note: text("note"),
  finalizedAt: integer("finalized_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  statusIdx: index("opnames_status_idx").on(t.status),
  dateIdx: index("opnames_date_idx").on(t.createdAt),
}));

export const stockOpnameItems = sqliteTable("stock_opname_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opnameId: integer("opname_id").notNull().references(() => stockOpnames.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => productVariants.id),
  systemStock: integer("system_stock").notNull(),
  physicalStock: integer("physical_stock").notNull(),
  diff: integer("diff").notNull(),
  reason: text("reason"),
}, (t) => ({
  opnameIdx: index("opname_items_opname_idx").on(t.opnameId),
  variantIdx: index("opname_items_variant_idx").on(t.variantId),
}));

export const cashEntries = sqliteTable("cash_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  entryDate: text("entry_date").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  typeIdx: index("cash_type_idx").on(t.type),
  dateIdx: index("cash_date_idx").on(t.entryDate),
  categoryIdx: index("cash_category_idx").on(t.category),
}));

export const discountRules = sqliteTable("discount_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  value: integer("value").notNull(),
  minPurchase: integer("min_purchase").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const vouchers = sqliteTable("vouchers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  type: text("type").notNull(),
  value: integer("value").notNull(),
  minPurchase: integer("min_purchase").notNull().default(0),
  maxDiscount: integer("max_discount"),
  validFrom: text("valid_from").notNull(),
  validUntil: text("valid_until"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  codeIdx: uniqueIndex("vouchers_code_idx").on(t.code),
  activeIdx: index("vouchers_active_idx").on(t.isActive, t.validFrom, t.validUntil),
}));

export const cashierShifts = sqliteTable("cashier_shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cashierId: integer("cashier_id").notNull().references(() => users.id),
  openedAt: integer("opened_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  startingCash: integer("starting_cash").notNull().default(0),
  expectedCash: integer("expected_cash"),
  actualCash: integer("actual_cash"),
  cashDiff: integer("cash_diff"),
  notes: text("notes"),
  status: text("status").notNull().default("open"), // 'open' | 'closed'
}, (t) => ({
  cashierStatusIdx: index("shifts_cashier_status_idx").on(t.cashierId, t.status),
}));

export const heldCarts = sqliteTable("held_carts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cashierId: integer("cashier_id").notNull().references(() => users.id),
  label: text("label").notNull(),
  cartJson: text("cart_json").notNull(),
  subtotal: integer("subtotal").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  cashierIdx: index("held_carts_cashier_idx").on(t.cashierId),
}));

export const searchFrequency = sqliteTable("search_frequency", {
  skuKey: text("sku_key").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const invoiceCounters = sqliteTable("invoice_counters", {
  day: text("day").primaryKey(),
  lastNo: integer("last_no").notNull().default(0),
});

export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales, { relationName: "cashier" }),
  shifts: many(cashierShifts),
  purchasesCreated: many(purchases, { relationName: "creator" }),
  purchasesReceived: many(purchases, { relationName: "receiver" }),
  movements: many(inventoryMovements),
  cashEntries: many(cashEntries),
  receivablePayments: many(receivablePayments),
}));

export const productsRelations = relations(products, ({ many }) => ({
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
  priceTiers: many(priceTiers),
}));

export const priceTiersRelations = relations(priceTiers, ({ one }) => ({
  variant: one(productVariants, { fields: [priceTiers.variantId], references: [productVariants.id] }),
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

export const cashierShiftsRelations = relations(cashierShifts, ({ one }) => ({
  cashier: one(users, { fields: [cashierShifts.cashierId], references: [users.id] }),
}));

export const heldCartsRelations = relations(heldCarts, ({ one }) => ({
  cashier: one(users, { fields: [heldCarts.cashierId], references: [users.id] }),
}));

export const outlets = sqliteTable("outlets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  isMain: integer("is_main", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const stockTransfers = sqliteTable("stock_transfers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transferNo: text("transfer_no").notNull().unique(),
  fromOutletId: integer("from_outlet_id").notNull().references(() => outlets.id),
  toOutletId: integer("to_outlet_id").notNull().references(() => outlets.id),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  receivedBy: integer("received_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  statusIdx: index("transfers_status_idx").on(t.status),
  dateIdx: index("transfers_date_idx").on(t.createdAt),
}));

export const stockTransferItems = sqliteTable("stock_transfer_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transferId: integer("transfer_id").notNull().references(() => stockTransfers.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => productVariants.id),
  qty: integer("qty").notNull(),
});

export const productBatches = sqliteTable("product_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  batchNo: text("batch_no").notNull(),
  expiryDate: text("expiry_date").notNull(), // YYYY-MM-DD
  qty: integer("qty").notNull().default(0),
  costPrice: integer("cost_price").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  expiryIdx: index("batches_expiry_idx").on(t.expiryDate),
  variantIdx: index("batches_variant_idx").on(t.variantId),
}));

export const stockTransfersRelations = relations(stockTransfers, ({ one, many }) => ({
  fromOutlet: one(outlets, { fields: [stockTransfers.fromOutletId], references: [outlets.id], relationName: "fromOutlet" }),
  toOutlet: one(outlets, { fields: [stockTransfers.toOutletId], references: [outlets.id], relationName: "toOutlet" }),
  creator: one(users, { fields: [stockTransfers.createdBy], references: [users.id], relationName: "creator" }),
  receiver: one(users, { fields: [stockTransfers.receivedBy], references: [users.id], relationName: "receiver" }),
  items: many(stockTransferItems),
}));

export const stockTransferItemsRelations = relations(stockTransferItems, ({ one }) => ({
  transfer: one(stockTransfers, { fields: [stockTransferItems.transferId], references: [stockTransfers.id] }),
  variant: one(productVariants, { fields: [stockTransferItems.variantId], references: [productVariants.id] }),
}));

export const productBatchesRelations = relations(productBatches, ({ one }) => ({
  variant: one(productVariants, { fields: [productBatches.variantId], references: [productVariants.id] }),
}));

