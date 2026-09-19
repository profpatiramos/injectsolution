import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import * as db from "../server/db";
import { supabaseAdmin } from "../server/supabase";
import { storagePut, storageGetSignedUrl } from "../server/storage";
import { sdk } from "../server/_core/sdk";
import { createApplication } from "../server/app";
if (process.env.ALLOW_LIVE_TESTS !== "yes") throw new Error("Defina ALLOW_LIVE_TESTS=yes para criar e remover apenas dados sintéticos deste teste.");
const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL!, { prepare: false, max: 1 });
const admin = supabaseAdmin();
const suffix = randomUUID();
const email = `smoke-${suffix}@example.invalid`;
const password = randomUUID() + randomUUID();
const objectKeys: string[] = [];
let authId: string | undefined;
let ownerId: number | undefined;
let memberId: number | undefined;
let orderId: number | undefined;
const server = createApplication().listen(3013, "127.0.0.1");
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error); authId = created.data.user!.id;
  await db.upsertUser({ openId: authId, email, name: "Teste temporário de integração", loginMethod: "supabase" });
  ownerId = (await db.getUserByOpenId(authId))!.id;
  await sql`update users set role = 'admin' where id = ${ownerId}`;
  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const login = await anon.auth.signInWithPassword({ email, password }); assert.ifError(login.error);
  const session = await fetch("http://127.0.0.1:3013/api/auth/session", { method: "POST", headers: { Origin: process.env.PUBLIC_APP_URL!, "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: login.data.session!.access_token }) });
  assert.equal(session.status, 200); const cookie = session.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await sdk.authenticateRequest({ headers: { cookie } } as any)).id, ownerId);
  console.log("PASS: autenticação real e sessão privada");
  memberId = (await db.addWorkspaceMember(ownerId, ownerId, { name: "Funcionário de teste", email: `member-${suffix}@example.invalid`, role: "separador" })).id;
  const order = await db.createOrder(ownerId, ownerId, { blingOrderNumber: `TEST-${suffix}`, customerName: "Cliente sintético de teste", items: [{ description: "Produto de teste", categoryName: "Teste", quantity: 2, unit: "UN" }] }); orderId = order.id;
  await assert.rejects(db.getOrderDetail(ownerId + 100000, orderId));
  await db.startSeparation(ownerId, memberId, orderId);
  let detail = await db.getOrderDetail(ownerId, orderId);
  const itemId = detail.items[0].id;
  await db.updateOrderItem(ownerId, memberId, { orderId, itemId, quantitySeparated: 2, quantityChecked: 0, status: "SEPARADO" });
  await db.updateOrderItem(ownerId, memberId, { orderId, itemId, quantitySeparated: 2, quantityChecked: 2, status: "CONFERIDO" });
  await assert.rejects(db.finalizeOrder(ownerId, memberId, orderId, false), /duas fotos/);
  console.log("PASS: equipe, pedido, isolamento, separação e conferência");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDBkAAAAASUVORK5CYII=", "base64");
  for (const kind of ["CAIXA_ABERTA", "CAIXA_FECHADA"] as const) {
    const file = await storagePut(`test/${suffix}/${kind}.png`, png, "image/png"); objectKeys.push(file.key);
    await db.addPhoto(ownerId, memberId, { orderId, kind, storageKey: file.key, url: file.url, filename: `${kind}.png`, mimeType: "image/png" });
    const signed = await storageGetSignedUrl(file.key); assert.equal((await fetch(signed)).status, 200);
    const publicResponse = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/public/order-evidence/${file.key}`); assert.notEqual(publicResponse.status, 200);
  }
  detail = await db.getOrderDetail(ownerId, orderId);
  assert.equal(detail.photos.length, 2); assert(detail.photos.every(photo => photo.uploadedByUserId === memberId && photo.capturedAt instanceof Date));
  assert.equal((await db.finalizeOrder(ownerId, memberId, orderId, false)).status, "PRONTO");
  await assert.rejects(db.updateOrderItem(ownerId, memberId, { orderId, itemId, quantitySeparated: 0, quantityChecked: 0, status: "PENDENTE" }));
  await assert.rejects(db.removePhoto(ownerId, memberId, detail.photos[0].id));
  console.log("PASS: fotos privadas, horários, finalização e bloqueios");
  await db.removeWorkspaceMember(ownerId, ownerId, memberId);
  assert((await db.getUserById(memberId))?.disabledAt);
  assert((await db.listWorkspaceActivity(ownerId)).some(event => event.action === "SEPARACAO_FINALIZADA"));
  const rls = await sql`select count(*)::int as n from pg_class where relnamespace = 'public'::regnamespace and relname in ('users','orders','order_items','order_photos','audit_logs','products','categories','bling_integrations') and relrowsecurity`;
  assert.equal(rls[0].n, 8);
  console.log("PASS: revogação, histórico e proteção das oito tabelas");
} finally {
  if (objectKeys.length) { const { error } = await admin.storage.from("order-evidence").remove(objectKeys); if (error) throw error; }
  if (orderId) { await sql`delete from order_photos where "orderId" = ${orderId}`; await sql`delete from order_items where "orderId" = ${orderId}`; await sql`delete from orders where id = ${orderId}`; }
  if (ownerId) { await sql`delete from audit_logs where "ownerId" = ${ownerId}`; await sql`delete from users where id = ${ownerId} or "workspaceOwnerId" = ${ownerId}`; }
  if (authId) { const { error } = await admin.auth.admin.deleteUser(authId); if (error) throw error; }
  await sql.end(); server.close();
  console.log("Dados e fotos sintéticos deste teste removidos.");
}
process.exit(0);
