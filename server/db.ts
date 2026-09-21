import { randomUUID } from "node:crypto";
import { normalizeEmail, assertManageableMember } from "./domain/team";
import type { EvidenceKind } from "../shared/evidence";
import { workspaceOwner } from "../shared/access";
import { assertOpenOrder, assertEditableOrder, assertItemTransition } from "../shared/operation";
import { getTableColumns, isNull, and, desc, eq, ilike, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  auditLogs,
  blingIntegrations,
  categories,
  type InsertUser,
  type ItemStatus,
  type OrderStatus,
  orderItems,
  orderPhotos,
  orders,
  products,
  type User,
  type Unit,
  users,
} from "../drizzle/schema";
import { deriveItemStatus, evaluateFinalization } from "./domain/separation";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && (process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
    try {
      _db = drizzle(postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL!, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15 }));
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível. Tente novamente em instantes.");
  return db;
}

// Email comes only from the server-side OAuth identity response, never a browser form.
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await requireDb();
  await db.transaction(async tx => {
    let [existing] = await tx.select().from(users).where(eq(users.openId, user.openId)).limit(1).for("update");
    const email = user.email ? normalizeEmail(user.email) : undefined;
    if (!existing && email) {
      const matches = await tx.select().from(users).where(eq(users.email, email)).limit(2).for("update");
      if (matches.length > 1) throw new Error("Há mais de um cadastro para este e-mail. Solicite a revisão ao administrador.");
      if (matches[0]) {
        if (!matches[0].openId.startsWith("pending:")) throw new Error("Este e-mail já está associado a outra identidade de acesso.");
        existing = matches[0];
      }
    }
    if (existing?.disabledAt) throw new Error("Seu acesso foi removido. Contate o administrador.");
    const values: Record<string, unknown> = { lastSignedIn: user.lastSignedIn ?? new Date() };
    if (user.name !== undefined && !existing?.name) values.name = user.name;
    if (email) values.email = email;
    if (user.loginMethod !== undefined) values.loginMethod = user.loginMethod;
    if (email === ENV.bootstrapAdminEmail && (!existing || !existing.workspaceOwnerId)) {
      values.role = "admin";
      values.workspaceOwnerId = null;
    }
    if (existing) await tx.update(users).set({ ...values, openId: user.openId }).where(eq(users.id, existing.id));
    else await tx.insert(users).values({ openId: user.openId, ...values });
  });
}

export function getWorkspaceOwnerId(user: Pick<User, "id" | "role" | "workspaceOwnerId">) {
  return workspaceOwner(user);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function listWorkspaceMembers(ownerId: number) {
  const db = await requireDb();
  return db
    .select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, disabledAt: users.disabledAt, workspaceOwnerId: users.workspaceOwnerId, lastSignedIn: users.lastSignedIn })
    .from(users)
    .where(and(or(eq(users.id, ownerId), eq(users.workspaceOwnerId, ownerId)), isNull(users.disabledAt)))
    .orderBy(users.name);
}

export async function listWorkspaceActivity(ownerId: number) {
  const db = await requireDb();
  return db.select({ ...getTableColumns(auditLogs), actorName: users.name, orderNumber: orders.blingOrderNumber })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .leftJoin(orders, and(eq(orders.id, auditLogs.orderId), eq(orders.ownerId, ownerId)))
    .where(eq(auditLogs.ownerId, ownerId)).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(100);
}

export async function setUserRole(ownerId: number, actorUserId: number, userId: number, role: "user" | "admin" | "separador") {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!target || target.disabledAt || (target.id !== ownerId && target.workspaceOwnerId !== ownerId)) throw new Error("Usuário não encontrado nesta equipe.");
    if (userId === ownerId && role !== "admin") throw new Error("O administrador principal não pode perder o perfil de administrador.");
    if (userId === actorUserId && role !== "admin") throw new Error("Você não pode remover seu próprio acesso administrativo.");
    await tx.update(users).set({ role, workspaceOwnerId: userId === ownerId ? null : ownerId }).where(eq(users.id, userId));
    await writeAudit(tx, { ownerId, actorUserId, action: "PERFIL_ATUALIZADO", details: { userId, role } });
    return { id: userId, role };
  });
}

export async function addWorkspaceMember(ownerId: number, actorUserId: number, input: { name: string; email: string; role: "admin" | "separador" }) {
  const db = await requireDb();
  const email = normalizeEmail(input.email);
  if (email === ENV.bootstrapAdminEmail) throw new Error("Este e-mail está reservado ao administrador principal.");
  return db.transaction(async tx => {
    // Serialize registration within the workspace, including repeated clicks.
    await tx.select().from(users).where(eq(users.id, ownerId)).limit(1).for("update");
    const matches = await tx.select().from(users).where(eq(users.email, email)).limit(2).for("update");
    if (matches.length > 1) throw new Error("Há cadastros duplicados para este e-mail.");
    const target = matches[0];
    let id: number;
    if (target) {
      if (target.id === ownerId || (target.workspaceOwnerId !== ownerId && (target.workspaceOwnerId || target.role !== "user"))) throw new Error("Não foi possível cadastrar este e-mail nesta equipe.");
      if (target.workspaceOwnerId === ownerId && !target.disabledAt) throw new Error("Este usuário já está na equipe. Altere o perfil na lista abaixo.");
      await tx.update(users).set({ name: input.name.trim(), role: input.role, workspaceOwnerId: ownerId, disabledAt: null }).where(eq(users.id, target.id));
      id = target.id;
    } else {
      const result = await tx.insert(users).values({ openId: "pending:" + randomUUID(), name: input.name.trim(), email, role: input.role, workspaceOwnerId: ownerId, loginMethod: "pending" }).returning();
      id = result[0]!.id;
    }
    await writeAudit(tx, { ownerId, actorUserId, action: "MEMBRO_ADICIONADO", details: { userId: id, role: input.role } });
    return { id };
  });
}

export async function removeWorkspaceMember(ownerId: number, actorUserId: number, userId: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!target) throw new Error("Usuário não encontrado.");
    assertManageableMember(ownerId, actorUserId, target);
    await tx.update(users).set({ disabledAt: new Date(), role: "user" }).where(eq(users.id, userId));
    await writeAudit(tx, { ownerId, actorUserId, action: "MEMBRO_REMOVIDO", details: { userId, name: target.name } });
    return { success: true };
  });
}

export async function getBlingIntegrationByState(state: string) {
  const db = await requireDb();
  const rows = await db.select().from(blingIntegrations).where(eq(blingIntegrations.oauthState, state)).limit(1);
  return rows[0];
}

export async function getBlingIntegration(ownerId: number) {
  const db = await requireDb();
  const rows = await db.select().from(blingIntegrations).where(eq(blingIntegrations.ownerId, ownerId)).limit(1);
  return rows[0];
}

export async function saveBlingIntegration(ownerId: number, values: Partial<typeof blingIntegrations.$inferInsert>) {
  const db = await requireDb();
  const existing = await getBlingIntegration(ownerId);
  if (existing) {
    await db.update(blingIntegrations).set(values).where(eq(blingIntegrations.ownerId, ownerId));
  } else {
    await db.insert(blingIntegrations).values({ ownerId, ...values });
  }
  return getBlingIntegration(ownerId);
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type OrderItemInput = {
  productId?: number;
  sku?: string;
  description: string;
  categoryName: string;
  quantity: number;
  unit: Unit;
  note?: string;
};

export type OrderInput = {
  blingOrderNumber: string;
  blingOrderId?: string;
  customerName: string;
  customerPhone?: string;
  customerNote?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleEngine?: string;
  vehicleCylinders?: string;
  vehicleConfiguration?: string;
  vehicleNotes?: string;
  items: OrderItemInput[];
  orderDate?: Date;
};

function optional(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function writeAudit(
  db: any,
  event: { ownerId: number; actorUserId: number; action: string; orderId?: number; orderItemId?: number; details?: unknown },
) {
  await db.insert(auditLogs).values({
    ownerId: event.ownerId,
    actorUserId: event.actorUserId,
    orderId: event.orderId ?? null,
    orderItemId: event.orderItemId ?? null,
    action: event.action,
    details: event.details ?? null,
  });
}

async function assertOrderOwnership(ownerId: number, orderId: number) {
  const db = await requireDb();
  const found = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.ownerId, ownerId)))
    .limit(1);
  if (!found[0]) throw new Error("Pedido não encontrado ou sem permissão de acesso.");
  return found[0];
}

export async function listOrders(
  ownerId: number,
  filters?: { search?: string; status?: OrderStatus },
) {
  const db = await requireDb();
  const clauses = [eq(orders.ownerId, ownerId)];
  if (filters?.status) clauses.push(eq(orders.status, filters.status));
  const term = filters?.search?.trim();
  if (term) {
    const token = `%${term}%`;
    clauses.push(
      or(
        ilike(orders.blingOrderNumber, token),
        ilike(orders.customerName, token),
        ilike(orders.vehicleModel, token),
        ilike(orders.vehicleEngine, token),
      )!,
    );
  }
  return db.select().from(orders).where(and(...clauses)).orderBy(desc(orders.createdAt));
}

export async function getDashboard(ownerId: number) {
  const records = await listOrders(ownerId);
  const statuses: OrderStatus[] = [
    "NOVO",
    "AGUARDANDO_SEPARACAO",
    "EM_SEPARACAO",
    "SEPARADO",
    "CONFERIDO",
    "COM_DIVERGENCIA",
    "PRONTO",
  ];
  const counts = Object.fromEntries(statuses.map(status => [status, 0])) as Record<OrderStatus, number>;
  records.forEach(record => {
    counts[record.status] += 1;
  });
  return { counts, recent: records.slice(0, 5), pending: records.filter(order => order.status !== "PRONTO").slice(0, 5) };
}

export async function getOrderDetail(ownerId: number, orderId: number) {
  const order = await assertOrderOwnership(ownerId, orderId);
  const db = await requireDb();
  const [items, photos, audit] = await Promise.all([
    db.select({ ...getTableColumns(orderItems), responsibleName: users.name }).from(orderItems).leftJoin(users, eq(users.id, orderItems.responsibleUserId)).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.categoryName, orderItems.id),
    db.select({ ...getTableColumns(orderPhotos), uploadedByName: users.name }).from(orderPhotos).leftJoin(users, eq(users.id, orderPhotos.uploadedByUserId)).where(eq(orderPhotos.orderId, orderId)).orderBy(desc(orderPhotos.capturedAt)),
    db.select({ ...getTableColumns(auditLogs), actorName: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).where(and(eq(auditLogs.orderId, orderId), eq(auditLogs.ownerId, ownerId))).orderBy(desc(auditLogs.createdAt)),
  ]);
  const responsible = order.responsibleUserId ? await getUserById(order.responsibleUserId) : undefined;
  return { order, items, photos, audit, responsibleName: responsible?.name || null };
}

async function insertOrderItems(db: any, orderId: number, items: OrderItemInput[]) {
  if (!items.length) return;
  await db.insert(orderItems).values(
    items.map(item => ({
      orderId,
      productId: item.productId ?? null,
      sku: optional(item.sku),
      description: item.description.trim(),
      categoryName: item.categoryName.trim() || "Outros",
      quantity: item.quantity,
      unit: item.unit,
      note: optional(item.note),
    })),
  );
}

function orderValues(input: OrderInput) {
  return {
    blingOrderNumber: input.blingOrderNumber.trim(),
    blingOrderId: input.blingOrderId === undefined ? undefined : optional(input.blingOrderId),
    orderDate: input.orderDate ?? undefined,
    customerName: input.customerName.trim(),
    customerPhone: optional(input.customerPhone),
    customerNote: optional(input.customerNote),
    vehicleBrand: optional(input.vehicleBrand),
    vehicleModel: optional(input.vehicleModel),
    vehicleYear: input.vehicleYear ?? null,
    vehicleEngine: optional(input.vehicleEngine),
    vehicleCylinders: optional(input.vehicleCylinders),
    vehicleConfiguration: optional(input.vehicleConfiguration),
    vehicleNotes: optional(input.vehicleNotes),
  };
}

export async function createOrder(ownerId: number, actorUserId: number, input: OrderInput) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const result = await tx.insert(orders).values({ ownerId, ...orderValues(input), status: "NOVO" }).returning();
    const orderId = result[0]?.id;
    if (!orderId) throw new Error("Não foi possível criar o pedido.");
    await insertOrderItems(tx, orderId, input.items);
    await writeAudit(tx, { ownerId, actorUserId, orderId, action: "PEDIDO_CRIADO", details: { itemCount: input.items.length } });
    return { id: orderId };
  });
}

export async function upsertImportedOrder(ownerId: number, actorUserId: number, input: OrderInput) {
  const db = await requireDb();
  const clauses = input.blingOrderId
    ? and(eq(orders.ownerId, ownerId), or(eq(orders.blingOrderId, input.blingOrderId), eq(orders.blingOrderNumber, input.blingOrderNumber)))
    : and(eq(orders.ownerId, ownerId), eq(orders.blingOrderNumber, input.blingOrderNumber));
  const [existing] = await db.select().from(orders).where(clauses).limit(1);
  if (existing) return { id: existing.id, skipped: true };
  // A new sync must not recreate an order deliberately removed by the administrator.
  const removals = await db.select().from(auditLogs).where(and(eq(auditLogs.ownerId, ownerId), eq(auditLogs.action, "PEDIDO_EXCLUIDO")));
  if (removals.some(event => (event.details as { number?: string } | null)?.number === input.blingOrderNumber)) return { skipped: true };
  return createOrder(ownerId, actorUserId, input);
}

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function lockedOrder<T>(ownerId: number, orderId: number, action: (tx: Transaction, order: typeof orders.$inferSelect) => Promise<T>, options?: { allowFinalizedDeletion: boolean }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.ownerId, ownerId))).limit(1).for("update");
    if (!order) throw new Error("Pedido não encontrado ou sem permissão de acesso.");
    if (!options?.allowFinalizedDeletion) assertOpenOrder(order);
    return action(tx, order);
  });
}

export async function assertPhotoUploadAllowed(ownerId: number, orderId: number) {
  assertOpenOrder(await assertOrderOwnership(ownerId, orderId));
}

export async function canReadOrderPhoto(ownerId: number, storageKey: string) {
  const db = await requireDb();
  const rows = await db.select({ id: orderPhotos.id }).from(orderPhotos)
    .innerJoin(orders, eq(orders.id, orderPhotos.orderId))
    .where(and(eq(orderPhotos.storageKey, storageKey), eq(orders.ownerId, ownerId))).limit(1);
  return rows.length > 0;
}

export async function updateOrder(ownerId: number, actorUserId: number, orderId: number, input: OrderInput) {
  return lockedOrder(ownerId, orderId, async (tx, order) => {
    assertEditableOrder(order);
    await tx.update(orders).set(orderValues(input)).where(eq(orders.id, orderId));
    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await insertOrderItems(tx, orderId, input.items);
    await writeAudit(tx, { ownerId, actorUserId, orderId, action: "PEDIDO_EDITADO", details: { itemCount: input.items.length } });
    return { id: orderId };
  });
}

export async function removeOrder(ownerId: number, actorUserId: number, orderId: number) {
  return lockedOrder(ownerId, orderId, async (tx, order) => {
    await tx.delete(orderPhotos).where(eq(orderPhotos.orderId, orderId));
    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await tx.delete(orders).where(eq(orders.id, orderId));
    await writeAudit(tx, { ownerId, actorUserId, orderId, action: "PEDIDO_EXCLUIDO", details: { number: order.blingOrderNumber, previousStatus: order.status, finalizedAt: order.finalizedAt } });
    return { success: true };
  }, { allowFinalizedDeletion: true });
}

export async function updateOrderItemNote(ownerId: number, actorUserId: number, input: { orderId: number; itemId: number; note: string }) {
  return lockedOrder(ownerId, input.orderId, async tx => {
    const [item] = await tx.select().from(orderItems).where(and(eq(orderItems.id, input.itemId), eq(orderItems.orderId, input.orderId))).limit(1);
    if (!item) throw new Error("Item não encontrado.");
    await tx.update(orderItems).set({ note: optional(input.note) }).where(eq(orderItems.id, item.id));
    await writeAudit(tx, { ownerId, actorUserId, orderId: input.orderId, orderItemId: item.id, action: "OBSERVACAO_ITEM_ATUALIZADA", details: { note: optional(input.note), status: item.status } });
    return { success: true };
  });
}

export async function updateOrderItem(ownerId: number, actorUserId: number, input: { orderId: number; itemId: number; quantitySeparated: number; quantityChecked: number; status: ItemStatus }) {
  return lockedOrder(ownerId, input.orderId, async (tx, order) => {
    const [item] = await tx.select().from(orderItems).where(and(eq(orderItems.id, input.itemId), eq(orderItems.orderId, input.orderId))).limit(1);
    if (!item) throw new Error("Item não encontrado.");
    assertItemTransition(item, input);
    const status = deriveItemStatus({ ...input, quantity: item.quantity });
    await tx.update(orderItems).set({ quantitySeparated: input.quantitySeparated, quantityChecked: input.quantityChecked, status, responsibleUserId: actorUserId, checkedAt: new Date() }).where(eq(orderItems.id, item.id));
    if (["NOVO", "AGUARDANDO_SEPARACAO"].includes(order.status)) await tx.update(orders).set({ status: "EM_SEPARACAO", responsibleUserId: actorUserId }).where(eq(orders.id, order.id));
    await writeAudit(tx, { ownerId, actorUserId, orderId: order.id, orderItemId: item.id, action: "ITEM_ATUALIZADO", details: { quantitySeparated: input.quantitySeparated, quantityChecked: input.quantityChecked, status } });
    return { status };
  });
}

export async function markAllItems(ownerId: number, actorUserId: number, orderId: number, mark: boolean) {
  return lockedOrder(ownerId, orderId, async (tx) => {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    if (!mark && items.some(item => ["SEPARADO", "CONFERIDO"].includes(item.status))) throw new Error("Itens separados ou conferidos não podem ser desmarcados.");
    for (const item of items) {
      // Preserve discrepancies and completed work during bulk separation.
      if (mark && item.status !== "PENDENTE") continue;
      await tx.update(orderItems).set({ status: mark ? "SEPARADO" : "PENDENTE", quantitySeparated: mark ? item.quantity : 0, quantityChecked: 0, responsibleUserId: actorUserId, checkedAt: new Date() }).where(eq(orderItems.id, item.id));
    }
    await tx.update(orders).set({ status: "EM_SEPARACAO", responsibleUserId: actorUserId }).where(eq(orders.id, orderId));
    await writeAudit(tx, { ownerId, actorUserId, orderId, action: mark ? "ITENS_SEPARADOS" : "ITENS_DESMARCADOS" });
    return { success: true };
  });
}

export async function startSeparation(ownerId: number, actorUserId: number, orderId: number) {
  return lockedOrder(ownerId, orderId, async (tx, order) => {
    if (!["NOVO", "AGUARDANDO_SEPARACAO"].includes(order.status)) throw new Error("A separação deste pedido já foi iniciada.");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).limit(1);
    if (!items.length) throw new Error("Adicione os produtos ao pedido antes de iniciar a separação.");
    await tx.update(orders).set({ status: "EM_SEPARACAO", responsibleUserId: actorUserId }).where(eq(orders.id, orderId));
    await writeAudit(tx, { ownerId, actorUserId, orderId, action: "SEPARACAO_INICIADA" });
    return { success: true };
  });
}

export async function addPhoto(ownerId: number, actorUserId: number, data: { kind: EvidenceKind; orderId: number; storageKey: string; url: string; filename: string; mimeType: string }) {
  return lockedOrder(ownerId, data.orderId, async tx => {
    const result = await tx.insert(orderPhotos).values({ ...data, uploadedByUserId: actorUserId, capturedAt: new Date() }).returning();
    await writeAudit(tx, { ownerId, actorUserId, orderId: data.orderId, action: "FOTO_ADICIONADA", details: { filename: data.filename, kind: data.kind } });
    return { id: result[0]?.id };
  });
}

export async function removePhoto(ownerId: number, actorUserId: number, photoId: number) {
  const db = await requireDb();
  const [photo] = await db.select().from(orderPhotos).where(eq(orderPhotos.id, photoId)).limit(1);
  if (!photo) throw new Error("Foto não encontrada.");
  return lockedOrder(ownerId, photo.orderId, async tx => {
    await tx.delete(orderPhotos).where(eq(orderPhotos.id, photoId));
    await writeAudit(tx, { ownerId, actorUserId, orderId: photo.orderId, action: "FOTO_REMOVIDA", details: { filename: photo.filename } });
    return { success: true };
  });
}

export async function finalizeOrder(ownerId: number, actorUserId: number, orderId: number, allowPending: boolean) {
  return lockedOrder(ownerId, orderId, async tx => {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const photos = await tx.select().from(orderPhotos).where(eq(orderPhotos.orderId, orderId));
    if (!items.length) throw new Error("Adicione itens ao pedido antes de finalizar.");
    const readiness = evaluateFinalization(items, photos);
    if (!readiness.hasPhoto) throw new Error("Envie as duas fotos obrigatórias: caixa aberta com os produtos e caixa fechada com o endereço do cliente.");
    if (!readiness.canFinalizeWithoutConfirmation && !allowPending) throw new Error("Existem pendências ou divergências. Confirme a finalização com pendências para continuar.");
    const status = readiness.finalStatus;
    await tx.update(orders).set({ status, responsibleUserId: actorUserId, finalizedAt: new Date() }).where(eq(orders.id, orderId));
    await writeAudit(tx, { ownerId, actorUserId, orderId, action: "SEPARACAO_FINALIZADA", details: { status, pendingItems: readiness.pendingItems.length } });
    return { status, pendingItems: readiness.pendingItems.length };
  });
}

export async function listCategories(ownerId: number) {
  const db = await requireDb();
  return db.select().from(categories).where(eq(categories.ownerId, ownerId)).orderBy(categories.name);
}

export async function createCategory(ownerId: number, actorUserId: number, name: string) {
  const db = await requireDb();
  const existing = await db.select().from(categories).where(and(eq(categories.ownerId, ownerId), eq(categories.name, name.trim()))).limit(1);
  if (existing[0]) return existing[0];
  const result = await db.insert(categories).values({ ownerId, name: name.trim() }).returning();
  const [category] = await db.select().from(categories).where(eq(categories.id, result[0]!.id)).limit(1);
  await writeAudit(db, { ownerId, actorUserId, action: "CATEGORIA_CRIADA", details: { category: name.trim() } });
  return category;
}

export async function listProducts(ownerId: number, search?: string) {
  const db = await requireDb();
  const term = search?.trim();
  const clause = term
    ? and(eq(products.ownerId, ownerId), or(ilike(products.name, `%${term}%`), ilike(products.sku, `%${term}%`))!)
    : eq(products.ownerId, ownerId);
  return db.select().from(products).where(and(clause, eq(products.active, true))).orderBy(desc(products.createdAt));
}

export async function createProduct(
  ownerId: number,
  actorUserId: number,
  input: { categoryId?: number; sku?: string; externalId?: string; name: string; description?: string; unit: Unit; note?: string },
) {
  const db = await requireDb();
  if (input.categoryId) {
    const [category] = await db.select().from(categories).where(and(eq(categories.id, input.categoryId), eq(categories.ownerId, ownerId))).limit(1);
    if (!category) throw new Error("Categoria não encontrada nesta equipe.");
  }
  const result = await db
    .insert(products)
    .values({
      ownerId,
      categoryId: input.categoryId ?? null,
      sku: optional(input.sku),
      externalId: optional(input.externalId),
      name: input.name.trim(),
      description: optional(input.description),
      unit: input.unit,
      note: optional(input.note),
    })
    .returning();
  await writeAudit(db, { ownerId, actorUserId, action: "PRODUTO_CRIADO", details: { productId: result[0]?.id, name: input.name.trim() } });
  return { id: result[0]?.id };
}

export async function removeProduct(ownerId: number, actorUserId: number, productId: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [product] = await tx.select().from(products).where(and(eq(products.id, productId), eq(products.ownerId, ownerId))).limit(1).for("update");
    if (!product) throw new Error("Produto não encontrado nesta equipe.");
    await tx.update(products).set({ active: false }).where(eq(products.id, productId));
    await writeAudit(tx, { ownerId, actorUserId, action: "PRODUTO_REMOVIDO", details: { productId, name: product.name } });
    return { success: true };
  });
}

export async function upsertBlingProduct(ownerId: number, actorUserId: number, input: { externalId: string; sku?: string; name: string; unit: Unit }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    // Serialize catalog imports for this workspace, including concurrent browser tabs.
    await tx.select().from(users).where(eq(users.id, ownerId)).limit(1).for("update");
    const [existing] = await tx.select().from(products).where(and(eq(products.ownerId, ownerId), or(eq(products.externalId, input.externalId), input.sku ? and(isNull(products.externalId), eq(products.sku, input.sku)) : undefined))).limit(1);
    if (existing) {
      await tx.update(products).set({ externalId: input.externalId, name: input.name, sku: input.sku || null, unit: input.unit }).where(eq(products.id, existing.id));
      return { id: existing.id };
    }
    const [created] = await tx.insert(products).values({ ownerId, ...input }).returning();
    await writeAudit(tx, { ownerId, actorUserId, action: "PRODUTO_IMPORTADO", details: { productId: created.id } });
    return { id: created.id };
  });
}

