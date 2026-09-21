CREATE TABLE "order_measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"ownerId" integer NOT NULL,
	"config" json NOT NULL,
	"response" json,
	"customerHash" varchar(64),
	"supplierHash" varchar(64),
	"expiresAt" timestamp with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"submittedAt" timestamp with time zone,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_measurements_orderId_unique" UNIQUE("orderId"),
	CONSTRAINT "order_measurements_customerHash_unique" UNIQUE("customerHash"),
	CONSTRAINT "order_measurements_supplierHash_unique" UNIQUE("supplierHash")
);
--> statement-breakpoint
ALTER TABLE "order_measurements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_measurements" ADD CONSTRAINT "order_measurements_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
REVOKE ALL ON "order_measurements" FROM anon, authenticated;
