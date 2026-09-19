CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`orderId` int,
	`orderItemId` int,
	`actorUserId` int NOT NULL,
	`action` varchar(120) NOT NULL,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bling_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'PENDENTE',
	`externalAccountId` varchar(160),
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bling_integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `bling_integrations_ownerId_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_owner_name_idx` UNIQUE(`ownerId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`sku` varchar(120),
	`description` varchar(320) NOT NULL,
	`categoryName` varchar(120) NOT NULL DEFAULT 'Outros',
	`quantity` int NOT NULL DEFAULT 1,
	`unit` enum('UN','METRO','JOGO','PAR','KIT','CONJUNTO','OUTRO') NOT NULL DEFAULT 'UN',
	`note` text,
	`status` enum('PENDENTE','SEPARADO','CONFERIDO','DIVERGENCIA','NAO_ENCONTRADO') NOT NULL DEFAULT 'PENDENTE',
	`quantitySeparated` int NOT NULL DEFAULT 0,
	`quantityChecked` int NOT NULL DEFAULT 0,
	`responsibleUserId` int,
	`checkedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`orderItemId` int,
	`storageKey` varchar(500) NOT NULL,
	`url` varchar(600) NOT NULL,
	`filename` varchar(240) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`blingOrderNumber` varchar(120) NOT NULL,
	`orderDate` timestamp NOT NULL DEFAULT (now()),
	`status` enum('NOVO','AGUARDANDO_SEPARACAO','EM_SEPARACAO','SEPARADO','CONFERIDO','COM_DIVERGENCIA','PRONTO') NOT NULL DEFAULT 'NOVO',
	`customerName` varchar(240) NOT NULL,
	`customerPhone` varchar(60),
	`customerNote` text,
	`vehicleBrand` varchar(120),
	`vehicleModel` varchar(160),
	`vehicleYear` int,
	`vehicleEngine` varchar(160),
	`vehicleCylinders` varchar(80),
	`vehicleConfiguration` varchar(240),
	`vehicleNotes` text,
	`responsibleUserId` int,
	`finalizedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`categoryId` int,
	`sku` varchar(120),
	`externalId` varchar(120),
	`name` varchar(240) NOT NULL,
	`description` text,
	`unit` enum('UN','METRO','JOGO','PAR','KIT','CONJUNTO','OUTRO') NOT NULL DEFAULT 'UN',
	`active` boolean NOT NULL DEFAULT true,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','separador') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `audit_owner_idx` ON `audit_logs` (`ownerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_order_idx` ON `audit_logs` (`orderId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `order_items_product_idx` ON `order_items` (`productId`);--> statement-breakpoint
CREATE INDEX `order_photos_order_idx` ON `order_photos` (`orderId`);--> statement-breakpoint
CREATE INDEX `orders_owner_idx` ON `orders` (`ownerId`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`ownerId`,`status`);--> statement-breakpoint
CREATE INDEX `orders_number_idx` ON `orders` (`ownerId`,`blingOrderNumber`);--> statement-breakpoint
CREATE INDEX `products_owner_idx` ON `products` (`ownerId`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`categoryId`);