import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers";
import { supabaseAdmin } from "../server/supabase";
import { upsertUser, getUserByOpenId } from "../server/db";
if (process.env.ALLOW_LIVE_TESTS !== "yes" || !process.env.LIVE_APP_URL) throw new Error("Configure ALLOW_LIVE_TESTS=yes e LIVE_APP_URL.");
const origin = new URL(process.env.LIVE_APP_URL).origin;
const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL!, { prepare: false, max: 1 });
const service = supabaseAdmin();
const suffix = randomUUID();
const authIds: string[] = [];
let ownerId: number | undefined;
let orderId: number | undefined;
async function identity(prefix: string) {
  const email = `${prefix}-${suffix}@example.invalid`, password = randomUUID() + randomUUID();
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
  authIds.push(created.data.user!.id);
  return { email, password, id: created.data.user!.id };
}
async function client(user: { email: string; password: string }) {
  const auth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword(user); assert.ifError(error);
  const response = await fetch(origin + "/api/auth/session", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: data.session!.access_token }) });
  assert.equal(response.status, 200, "Sessão na publicação deve ser criada");
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  return { cookie, api: createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: origin + "/api/trpc", transformer: superjson, headers: { Cookie: cookie } })] }) };
}
try {
  const owner = await identity("published-admin");
  await upsertUser({ openId: owner.id, email: owner.email, name: "Teste temporário online" });
  ownerId = (await getUserByOpenId(owner.id))!.id;
  await sql`update users set role = 'admin' where id = ${ownerId}`;
  const admin = await client(owner);
  assert.equal((await admin.api.auth.me.query())?.role, "admin");
  const memberEmail = `published-worker-${suffix}@example.invalid`;
  const member = await admin.api.admin.addMember.mutate({ name: "Funcionário temporário", email: memberEmail, role: "separador" });
  const workerIdentity = await identity("published-worker");
  const worker = await client(workerIdentity);
  assert.equal((await worker.api.auth.me.query())?.id, member.id);
  await assert.rejects(worker.api.admin.members.query());
  const product = await worker.api.catalog.createProduct.mutate({ name: "Produto sintético", unit: "UN" });
  assert((await worker.api.catalog.products.query()).some(item => item.id === product.id));
  await worker.api.catalog.removeProduct.mutate({ id: product.id! });
  assert(!(await worker.api.catalog.products.query()).some(item => item.id === product.id));
  orderId = (await admin.api.orders.create.mutate({ blingOrderNumber: "TEST-ONLINE-" + suffix, customerName: "Cliente sintético", items: [{ description: "Item sintético", categoryName: "Teste", quantity: 1, unit: "UN" }] })).id;
  await worker.api.orders.startSeparation.mutate({ orderId });
  let detail = await worker.api.orders.get.query({ id: orderId });
  const itemId = detail.items[0].id;
  await worker.api.orders.updateItem.mutate({ orderId, itemId, quantitySeparated: 1, quantityChecked: 0, status: "SEPARADO" });
  await worker.api.orders.updateItem.mutate({ orderId, itemId, quantitySeparated: 1, quantityChecked: 1, status: "CONFERIDO" });
  await worker.api.orders.updateItemNote.mutate({ orderId, itemId, note: "Conferência sintética revisada" });
  const noted = await worker.api.orders.get.query({ id: orderId });
  assert.equal(noted.items[0].note, "Conferência sintética revisada");
  assert.equal(noted.items[0].status, "CONFERIDO");
  assert(noted.items[0].responsibleName);
  assert.equal(noted.audit.length, 0);
  assert((await admin.api.orders.get.query({ id: orderId })).audit.some(event => event.action === "OBSERVACAO_ITEM_ATUALIZADA"));
  await assert.rejects(worker.api.orders.finalize.mutate({ orderId, allowPending: false }));
  for (const kind of ["CAIXA_ABERTA", "CAIXA_FECHADA"] as const) await worker.api.photos.upload.mutate({ orderId, kind, filename: "test.png", mimeType: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDBkAAAAASUVORK5CYII=" });
  detail = await worker.api.orders.get.query({ id: orderId });
  assert.equal(detail.photos.length, 2);
  const privatePhoto = origin + detail.photos[0].url;
  assert.equal((await fetch(privatePhoto, { headers: { Cookie: worker.cookie } })).status, 200);
  assert.equal((await fetch(privatePhoto)).status, 401);
  assert.equal((await worker.api.orders.finalize.mutate({ orderId, allowPending: false })).status, "PRONTO");
  await assert.rejects(worker.api.photos.remove.mutate({ photoId: detail.photos[0].id }));
  await assert.rejects(worker.api.orders.updateItemNote.mutate({ orderId, itemId, note: "Não deve salvar" }));
  const disposable = await admin.api.orders.create.mutate({ blingOrderNumber: "TEST-REMOVE-" + suffix, customerName: "Cliente sintético", items: [{ description: "Item temporário", categoryName: "Outros", quantity: 1, unit: "UN" }] });
  try {
    await worker.api.orders.startSeparation.mutate({ orderId: disposable.id });
    await assert.rejects(worker.api.orders.remove.mutate({ id: disposable.id }));
    await admin.api.orders.remove.mutate({ id: disposable.id });
    await assert.rejects(admin.api.orders.get.query({ id: disposable.id }));
  } finally {
    await sql`delete from order_items where "orderId" = ${disposable.id}`;
    await sql`delete from orders where id = ${disposable.id}`;
  }
  assert((await admin.api.admin.activity.query()).some(event => event.action === "SEPARACAO_FINALIZADA"));
  await admin.api.admin.removeMember.mutate({ userId: member.id });
  await assert.rejects(worker.api.orders.list.query());
  console.log("PASS ONLINE: login, pré-cadastro, permissões, pedido, etapas, fotos privadas, finalização, histórico e revogação.");
} finally {
  if (orderId) {
    const photos = await sql`select "storageKey" from order_photos where "orderId" = ${orderId}`;
    if (photos.length) { const { error } = await service.storage.from("order-evidence").remove(photos.map(photo => photo.storageKey)); assert.ifError(error); }
    await sql`delete from order_photos where "orderId" = ${orderId}`; await sql`delete from order_items where "orderId" = ${orderId}`; await sql`delete from orders where id = ${orderId}`;
  }
  if (ownerId) { await sql`delete from products where "ownerId" = ${ownerId}`; await sql`delete from audit_logs where "ownerId" = ${ownerId}`; await sql`delete from users where id = ${ownerId} or "workspaceOwnerId" = ${ownerId}`; }
  for (const id of authIds) { const { error } = await service.auth.admin.deleteUser(id); assert.ifError(error); }
  await sql.end(); console.log("Dados sintéticos do teste online removidos.");
}
process.exit(0);
