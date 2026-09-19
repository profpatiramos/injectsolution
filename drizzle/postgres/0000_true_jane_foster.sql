CREATE TYPE "public"."evidence_kind" AS ENUM('CAIXA_ABERTA', 'CAIXA_FECHADA', 'LEGADO');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('PENDENTE', 'SEPARADO', 'CONFERIDO', 'DIVERGENCIA', 'NAO_ENCONTRADO');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('NOVO', 'AGUARDANDO_SEPARACAO', 'EM_SEPARACAO', 'SEPARADO', 'CONFERIDO', 'COM_DIVERGENCIA', 'PRONTO');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'separador');--> statement-breakpoint
CREATE TYPE "public"."product_unit" AS ENUM('UN', 'METRO', 'JOGO', 'PAR', 'KIT', 'CONJUNTO', 'OUTRO');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"orderId" integer,
	"orderItemId" integer,
	"actorUserId" integer NOT NULL,
	"action" varchar(120) NOT NULL,
	"details" json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bling_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"status" varchar(40) DEFAULT 'PENDENTE' NOT NULL,
	"externalAccountId" varchar(160),
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"oauthState" varchar(160),
	"lastSyncedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bling_integrations_ownerId_unique" UNIQUE("ownerId")
);
--> statement-breakpoint
ALTER TABLE "bling_integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"productId" integer,
	"sku" varchar(120),
	"description" varchar(320) NOT NULL,
	"categoryName" varchar(120) DEFAULT 'Outros' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" "product_unit" DEFAULT 'UN' NOT NULL,
	"note" text,
	"status" "item_status" DEFAULT 'PENDENTE' NOT NULL,
	"quantitySeparated" integer DEFAULT 0 NOT NULL,
	"quantityChecked" integer DEFAULT 0 NOT NULL,
	"responsibleUserId" integer,
	"checkedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"orderItemId" integer,
	"storageKey" varchar(500) NOT NULL,
	"url" varchar(600) NOT NULL,
	"filename" varchar(240) NOT NULL,
	"mimeType" varchar(120) NOT NULL,
	"uploadedByUserId" integer NOT NULL,
	"kind" "evidence_kind" DEFAULT 'LEGADO' NOT NULL,
	"capturedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"blingOrderNumber" varchar(120) NOT NULL,
	"blingOrderId" varchar(120),
	"orderDate" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "order_status" DEFAULT 'NOVO' NOT NULL,
	"customerName" varchar(240) NOT NULL,
	"customerPhone" varchar(60),
	"customerNote" text,
	"vehicleBrand" varchar(120),
	"vehicleModel" varchar(160),
	"vehicleYear" integer,
	"vehicleEngine" varchar(160),
	"vehicleCylinders" varchar(80),
	"vehicleConfiguration" varchar(240),
	"vehicleNotes" text,
	"responsibleUserId" integer,
	"finalizedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"ownerId" integer NOT NULL,
	"categoryId" integer,
	"sku" varchar(120),
	"externalId" varchar(120),
	"name" varchar(240) NOT NULL,
	"description" text,
	"unit" "product_unit" DEFAULT 'UN' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"disabledAt" timestamp with time zone,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"workspaceOwnerId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "audit_owner_idx" ON "audit_logs" USING btree ("ownerId","createdAt");--> statement-breakpoint
CREATE INDEX "audit_order_idx" ON "audit_logs" USING btree ("orderId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_owner_name_idx" ON "categories" USING btree ("ownerId","name");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("productId");--> statement-breakpoint
CREATE INDEX "order_photos_order_idx" ON "order_photos" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "orders_owner_idx" ON "orders" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("ownerId","status");--> statement-breakpoint
CREATE INDEX "orders_number_idx" ON "orders" USING btree ("ownerId","blingOrderNumber");--> statement-breakpoint
CREATE INDEX "products_owner_idx" ON "products" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("categoryId");