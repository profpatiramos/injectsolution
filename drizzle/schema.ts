import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

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
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  disabledAt: timestamp("disabledAt"),
      role: mysqlEnum("role", userRoles).default("user").notNull(),
    workspaceOwnerId: int("workspaceOwnerId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),

  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Categorias pertencem ao espaço operacional de cada usuário. */
export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerNameIdx: uniqueIndex("categories_owner_name_idx").on(table.ownerId, table.name),
  }),
);

/** Catálogo independente dos itens já adicionados a pedidos. */
export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    categoryId: int("categoryId"),
    sku: varchar("sku", { length: 120 }),
    externalId: varchar("externalId", { length: 120 }),
    name: varchar("name", { length: 240 }).notNull(),
    description: text("description"),
    unit: mysqlEnum("unit", units).default("UN").notNull(),
    active: boolean("active").default(true).notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerIdx: index("products_owner_idx").on(table.ownerId),
    categoryIdx: index("products_category_idx").on(table.categoryId),
  }),
);

/** Pedido comercial convertido para a operação, sem campos financeiros. */
export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    blingOrderNumber: varchar("blingOrderNumber", { length: 120 }).notNull(),
    blingOrderId: varchar("blingOrderId", { length: 120 }),
    orderDate: timestamp("orderDate").defaultNow().notNull(),
    status: mysqlEnum("status", orderStatuses).default("NOVO").notNull(),
    customerName: varchar("customerName", { length: 240 }).notNull(),
    customerPhone: varchar("customerPhone", { length: 60 }),
    customerNote: text("customerNote"),
    vehicleBrand: varchar("vehicleBrand", { length: 120 }),
    vehicleModel: varchar("vehicleModel", { length: 160 }),
    vehicleYear: int("vehicleYear"),
    vehicleEngine: varchar("vehicleEngine", { length: 160 }),
    vehicleCylinders: varchar("vehicleCylinders", { length: 80 }),
    vehicleConfiguration: varchar("vehicleConfiguration", { length: 240 }),
    vehicleNotes: text("vehicleNotes"),
    responsibleUserId: int("responsibleUserId"),
    finalizedAt: timestamp("finalizedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerIdx: index("orders_owner_idx").on(table.ownerId),
    statusIdx: index("orders_status_idx").on(table.ownerId, table.status),
    numberIdx: index("orders_number_idx").on(table.ownerId, table.blingOrderNumber),
  }),
);

/** Checklist operacional de cada pedido. Nunca inclui preços ou subtotais. */
export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull(),
    productId: int("productId"),
    sku: varchar("sku", { length: 120 }),
    description: varchar("description", { length: 320 }).notNull(),
    categoryName: varchar("categoryName", { length: 120 }).notNull().default("Outros"),
    quantity: int("quantity").notNull().default(1),
    unit: mysqlEnum("unit", units).default("UN").notNull(),
    note: text("note"),
    status: mysqlEnum("status", itemStatuses).default("PENDENTE").notNull(),
    quantitySeparated: int("quantitySeparated").notNull().default(0),
    quantityChecked: int("quantityChecked").notNull().default(0),
    responsibleUserId: int("responsibleUserId"),
    checkedAt: timestamp("checkedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    orderIdx: index("order_items_order_idx").on(table.orderId),
    productIdx: index("order_items_product_idx").on(table.productId),
  }),
);

/** Evidências fotográficas vinculadas ao pedido, com espaço para vincular item no futuro. */
export const orderPhotos = mysqlTable(
  "order_photos",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull(),
    orderItemId: int("orderItemId"),
    storageKey: varchar("storageKey", { length: 500 }).notNull(),
    url: varchar("url", { length: 600 }).notNull(),
    filename: varchar("filename", { length: 240 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    uploadedByUserId: int("uploadedByUserId").notNull(),
    kind: mysqlEnum("kind", ["CAIXA_ABERTA", "CAIXA_FECHADA", "LEGADO"]).default("LEGADO").notNull(),
    capturedAt: timestamp("capturedAt").defaultNow().notNull(),
  },
  table => ({
    orderIdx: index("order_photos_order_idx").on(table.orderId),
  }),
);

/** Registro de eventos para rastreabilidade da operação. */
export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    orderId: int("orderId"),
    orderItemId: int("orderItemId"),
    actorUserId: int("actorUserId").notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    details: json("details"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerIdx: index("audit_owner_idx").on(table.ownerId, table.createdAt),
    orderIdx: index("audit_order_idx").on(table.orderId, table.createdAt),
  }),
);

/** Persistência preparada para credenciais e estado de sincronização futura com o Bling. */
export const blingIntegrations = mysqlTable(
  "bling_integrations",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().unique(),
    status: varchar("status", { length: 40 }).notNull().default("PENDENTE"),
    externalAccountId: varchar("externalAccountId", { length: 160 }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    oauthState: varchar("oauthState", { length: 160 }),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type OrderStatus = (typeof orderStatuses)[number];
export type ItemStatus = (typeof itemStatuses)[number];
export type Unit = (typeof units)[number];
