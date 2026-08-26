CREATE TABLE `cash_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(16) NOT NULL,
	`category` varchar(64) NOT NULL,
	`description` varchar(256) NOT NULL,
	`amount` int NOT NULL,
	`entry_date` date NOT NULL,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discount_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`type` varchar(16) NOT NULL,
	`value` int NOT NULL,
	`min_purchase` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`starts_at` date,
	`ends_at` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discount_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`variant_id` int,
	`type` varchar(16) NOT NULL,
	`qty` int NOT NULL,
	`ref_type` varchar(32),
	`ref_id` int,
	`note` text,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_counters` (
	`day` varchar(8) NOT NULL,
	`last_no` int NOT NULL DEFAULT 0,
	CONSTRAINT `invoice_counters_day` PRIMARY KEY(`day`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`label` varchar(64) NOT NULL,
	`barcode` varchar(64),
	`selling_price` int NOT NULL DEFAULT 0,
	`cost_price` int NOT NULL DEFAULT 0,
	`stock` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_barcode_idx` UNIQUE(`barcode`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL,
	`barcode` varchar(64),
	`stock` int NOT NULL DEFAULT 0,
	`min_stock` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_barcode_idx` UNIQUE(`barcode`)
);
--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchase_id` int NOT NULL,
	`variant_id` int NOT NULL,
	`qty_ordered` int NOT NULL,
	`qty_received` int NOT NULL DEFAULT 0,
	`unit_cost` int NOT NULL,
	CONSTRAINT `purchase_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_id` int NOT NULL,
	`invoice_no` varchar(64) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`total_cost` int NOT NULL DEFAULT 0,
	`notes` text,
	`expected_at` date,
	`created_by` int NOT NULL,
	`received_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`received_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchases_invoice_no_unique` UNIQUE(`invoice_no`),
	CONSTRAINT `purchases_invoice_idx` UNIQUE(`invoice_no`)
);
--> statement-breakpoint
CREATE TABLE `receivable_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivable_id` int NOT NULL,
	`amount` int NOT NULL,
	`note` text,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receivable_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receivables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sale_id` int NOT NULL,
	`customer_name` varchar(128) NOT NULL,
	`amount` int NOT NULL,
	`paid_amount` int NOT NULL DEFAULT 0,
	`due_date` date NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'open',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receivables_id` PRIMARY KEY(`id`),
	CONSTRAINT `receivables_sale_id_unique` UNIQUE(`sale_id`)
);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sale_id` int NOT NULL,
	`product_id` int NOT NULL,
	`variant_id` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`qty` int NOT NULL,
	`unit_price` int NOT NULL,
	`cost_price_at_sale` int NOT NULL DEFAULT 0,
	`discount` int NOT NULL DEFAULT 0,
	`line_total` int NOT NULL,
	CONSTRAINT `sale_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sale_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sale_id` int NOT NULL,
	`method` varchar(16) NOT NULL,
	`amount` int NOT NULL,
	`reference_no` varchar(64),
	CONSTRAINT `sale_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_no` varchar(64) NOT NULL,
	`cashier_id` int NOT NULL,
	`subtotal` int NOT NULL,
	`discount_total` int NOT NULL DEFAULT 0,
	`voucher_code` varchar(64),
	`voucher_discount` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`payment_method` varchar(16) NOT NULL,
	`paid_amount` int NOT NULL,
	`change_amount` int NOT NULL DEFAULT 0,
	`status` varchar(16) NOT NULL DEFAULT 'completed',
	`customer_name` varchar(128),
	`due_date` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_invoice_no_unique` UNIQUE(`invoice_no`),
	CONSTRAINT `sales_invoice_idx` UNIQUE(`invoice_no`)
);
--> statement-breakpoint
CREATE TABLE `search_frequency` (
	`sku_key` varchar(128) NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `search_frequency_sku_key` PRIMARY KEY(`sku_key`)
);
--> statement-breakpoint
CREATE TABLE `stock_opname_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`opname_id` int NOT NULL,
	`variant_id` int NOT NULL,
	`system_stock` int NOT NULL,
	`physical_stock` int NOT NULL,
	`diff` int NOT NULL,
	`reason` varchar(128),
	CONSTRAINT `stock_opname_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_opnames` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'open',
	`responsible_name` varchar(128) NOT NULL,
	`responsible_user_id` int,
	`note` text,
	`finalized_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_opnames_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_opnames_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`phone` varchar(32),
	`address` text,
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`open_id` varchar(128),
	`username` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`email` varchar(128),
	`password_hash` varchar(256) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'kasir',
	`login_method` varchar(32) NOT NULL DEFAULT 'password',
	`last_login_at` timestamp,
	`token_version` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_open_id_unique` UNIQUE(`open_id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`type` varchar(16) NOT NULL,
	`value` int NOT NULL,
	`min_purchase` int NOT NULL DEFAULT 0,
	`max_discount` int,
	`valid_from` date NOT NULL,
	`valid_until` date,
	`usage_limit` int,
	`used_count` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `vouchers_code_unique` UNIQUE(`code`),
	CONSTRAINT `vouchers_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `cash_entries` ADD CONSTRAINT `cash_entries_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_purchase_id_purchases_id_fk` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_received_by_users_id_fk` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receivable_payments` ADD CONSTRAINT `receivable_payments_receivable_id_receivables_id_fk` FOREIGN KEY (`receivable_id`) REFERENCES `receivables`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receivable_payments` ADD CONSTRAINT `receivable_payments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receivables` ADD CONSTRAINT `receivables_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sale_payments` ADD CONSTRAINT `sale_payments_sale_id_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_cashier_id_users_id_fk` FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_opname_items` ADD CONSTRAINT `stock_opname_items_opname_id_stock_opnames_id_fk` FOREIGN KEY (`opname_id`) REFERENCES `stock_opnames`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_opname_items` ADD CONSTRAINT `stock_opname_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_opnames` ADD CONSTRAINT `stock_opnames_responsible_user_id_users_id_fk` FOREIGN KEY (`responsible_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cash_type_idx` ON `cash_entries` (`type`);--> statement-breakpoint
CREATE INDEX `cash_date_idx` ON `cash_entries` (`entry_date`);--> statement-breakpoint
CREATE INDEX `cash_category_idx` ON `cash_entries` (`category`);--> statement-breakpoint
CREATE INDEX `movements_product_idx` ON `inventory_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `movements_variant_idx` ON `inventory_movements` (`variant_id`);--> statement-breakpoint
CREATE INDEX `movements_type_idx` ON `inventory_movements` (`type`);--> statement-breakpoint
CREATE INDEX `movements_ref_idx` ON `inventory_movements` (`ref_type`,`ref_id`);--> statement-breakpoint
CREATE INDEX `movements_date_idx` ON `inventory_movements` (`created_at`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `variants_stock_idx` ON `product_variants` (`stock`,`is_active`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `products_low_stock_idx` ON `products` (`stock`,`min_stock`,`is_active`);--> statement-breakpoint
CREATE INDEX `purchase_items_purchase_idx` ON `purchase_items` (`purchase_id`);--> statement-breakpoint
CREATE INDEX `purchase_items_variant_idx` ON `purchase_items` (`variant_id`);--> statement-breakpoint
CREATE INDEX `purchases_supplier_idx` ON `purchases` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchases_status_idx` ON `purchases` (`status`);--> statement-breakpoint
CREATE INDEX `purchases_date_idx` ON `purchases` (`created_at`);--> statement-breakpoint
CREATE INDEX `receivable_payments_receivable_idx` ON `receivable_payments` (`receivable_id`);--> statement-breakpoint
CREATE INDEX `receivables_status_idx` ON `receivables` (`status`);--> statement-breakpoint
CREATE INDEX `receivables_due_idx` ON `receivables` (`due_date`,`status`);--> statement-breakpoint
CREATE INDEX `receivables_customer_idx` ON `receivables` (`customer_name`);--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `sale_items_variant_idx` ON `sale_items` (`variant_id`);--> statement-breakpoint
CREATE INDEX `sale_payments_sale_idx` ON `sale_payments` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sales_cashier_idx` ON `sales` (`cashier_id`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `sales_status_idx` ON `sales` (`status`);--> statement-breakpoint
CREATE INDEX `sales_due_date_idx` ON `sales` (`due_date`);--> statement-breakpoint
CREATE INDEX `opname_items_opname_idx` ON `stock_opname_items` (`opname_id`);--> statement-breakpoint
CREATE INDEX `opname_items_variant_idx` ON `stock_opname_items` (`variant_id`);--> statement-breakpoint
CREATE INDEX `opnames_status_idx` ON `stock_opnames` (`status`);--> statement-breakpoint
CREATE INDEX `opnames_date_idx` ON `stock_opnames` (`created_at`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `vouchers_active_idx` ON `vouchers` (`is_active`,`valid_from`,`valid_until`);