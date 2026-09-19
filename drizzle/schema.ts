import {
  boolean,
  index,
  integer,
  serial,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoles = ["user", "admin", "separador"] as const;
export const orderStatuses = [
  "NOVO",
  "AGUARDANDO_SEPARACAO",
  "EM_SEPARACAO",
  "SEPARADO",
  "CONFERIDO",
  "COM_DIVERGENCIA",
  "PRONTO",
] as const;
export const itemStatuses = [
  "PENDENTE",
  "SEPARADO",
  "CONFERIDO",
  "DIVERGENCIA",
  "NAO_ENCONTRADO",
] as const;
export const units = ["UN", "METRO", "JOGO", "PAR", "KIT", "CONJUNTO", "OUTRO"] as const;

/** Usuários são providos pelo fluxo OAuth da plataforma. */
export const roleEnum = pgEnum("user_role", userRoles);
export const orderStatusEnum = pgEnum("order_status", orderStatuses);
export const itemStatusEnum = pgEnum("item_status", itemStatuses);
export const unitEnum = pgEnum("product_unit", units);
export const evidenceEnum = pgEnum("evidence_kind", ["CAIXA_ABERTA", "CAIXA_FECHADA", "LEGADO"]);
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  disabledAt: timestamp("disabledAt", { withTimezone: true }),
      role: roleEnum("role").default("user").notNull(),
    workspaceOwnerId: integer("workspaceOwnerId"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),

  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

/** Categorias pertencem ao espaço operacional de cada usuário. */
export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("ownerId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => ({
    ownerNameIdx: uniqueIndex("categories_owner_name_idx").on(table.ownerId, table.name),
  }),
).enableRLS();

/** Catálogo independente dos itens já adicionados a pedidos. */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("ownerId").notNull(),
    categoryId: integer("categoryId"),
    sku: varchar("sku", { length: 120 }),
    externalId: varchar("externalId", { length: 120 }),
    name: varchar("name", { length: 240 }).notNull(),
    description: text("description"),
    unit: unitEnum("unit").default("UN").notNull(),
    active: boolean("active").default(true).notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => ({
    ownerIdx: index("products_owner_idx").on(table.ownerId),
    categoryIdx: index("products_category_idx").on(table.categoryId),
  }),
).enableRLS();

/** Pedido comercial convertido para a operação, sem campos financeiros. */
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("ownerId").notNull(),
    blingOrderNumber: varchar("blingOrderNumber", { length: 120 }).notNull(),
    blingOrderId: varchar("blingOrderId", { length: 120 }),
    orderDate: timestamp("orderDate", { withTimezone: true }).defaultNow().notNull(),
    status: orderStatusEnum("status").default("NOVO").notNull(),
    customerName: varchar("customerName", { length: 240 }).notNull(),
    customerPhone: varchar("customerPhone", { length: 60 }),
    customerNote: text("customerNote"),
    vehicleBrand: varchar("vehicleBrand", { length: 120 }),
    vehicleModel: varchar("vehicleModel", { length: 160 }),
    vehicleYear: integer("vehicleYear"),
    vehicleEngine: varchar("vehicleEngine", { length: 160 }),
    vehicleCylinders: varchar("vehicleCylinders", { length: 80 }),
    vehicleConfiguration: varchar("vehicleConfiguration", { length: 240 }),
    vehicleNotes: text("vehicleNotes"),
    responsibleUserId: integer("responsibleUserId"),
    finalizedAt: timestamp("finalizedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => ({
    ownerIdx: index("orders_owner_idx").on(table.ownerId),
    statusIdx: index("orders_status_idx").on(table.ownerId, table.status),
    numberIdx: index("orders_number_idx").on(table.ownerId, table.blingOrderNumber),
  }),
).enableRLS();

/** Checklist operacional de cada pedido. Nunca inclui preços ou subtotais. */
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("orderId").notNull(),
    productId: integer("productId"),
    sku: varchar("sku", { length: 120 }),
    description: varchar("description", { length: 320 }).notNull(),
    categoryName: varchar("categoryName", { length: 120 }).notNull().default("Outros"),
    quantity: integer("quantity").notNull().default(1),
    unit: unitEnum("unit").default("UN").notNull(),
    note: text("note"),
    status: itemStatusEnum("status").default("PENDENTE").notNull(),
    quantitySeparated: integer("quantitySeparated").notNull().default(0),
    quantityChecked: integer("quantityChecked").notNull().default(0),
    responsibleUserId: integer("responsibleUserId"),
    checkedAt: timestamp("checkedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => ({
    orderIdx: index("order_items_order_idx").on(table.orderId),
    productIdx: index("order_items_product_idx").on(table.productId),
  }),
).enableRLS();

/** Evidências fotográficas vinculadas ao pedido, com espaço para vincular item no futuro. */
export const orderPhotos = pgTable(
  "order_photos",
  {
    id: serial("id").primaryKey(),
    orderId: integer("orderId").notNull(),
    orderItemId: integer("orderItemId"),
    storageKey: varchar("storageKey", { length: 500 }).notNull(),
    url: varchar("url", { length: 600 }).notNull(),
    filename: varchar("filename", { length: 240 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    uploadedByUserId: integer("uploadedByUserId").notNull(),
    kind: evidenceEnum("kind").default("LEGADO").notNull(),
    capturedAt: timestamp("capturedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    orderIdx: index("order_photos_order_idx").on(table.orderId),
  }),
).enableRLS();

/** Registro de eventos para rastreabilidade da operação. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("ownerId").notNull(),
    orderId: integer("orderId"),
    orderItemId: integer("orderItemId"),
    actorUserId: integer("actorUserId").notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    details: json("details"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("audit_owner_idx").on(table.ownerId, table.createdAt),
    orderIdx: index("audit_order_idx").on(table.orderId, table.createdAt),
  }),
).enableRLS();

/** Persistência preparada para credenciais e estado de sincronização futura com o Bling. */
export const blingIntegrations = pgTable(
  "bling_integrations",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("ownerId").notNull().unique(),
    status: varchar("status", { length: 40 }).notNull().default("PENDENTE"),
    externalAccountId: varchar("externalAccountId", { length: 160 }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    oauthState: varchar("oauthState", { length: 160 }),
    lastSyncedAt: timestamp("lastSyncedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
).enableRLS();

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type OrderStatus = (typeof orderStatuses)[number];
export type ItemStatus = (typeof itemStatuses)[number];
export type Unit = (typeof units)[number];

