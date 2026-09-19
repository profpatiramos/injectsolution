import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "vpramos85@gmail.com").trim().toLowerCase();
if (!process.env.PUBLIC_APP_URL) throw new Error("Configure PUBLIC_APP_URL antes de gerar o primeiro acesso.");
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL, { prepare: false, max: 1 });
try {
  await sql`insert into users ("openId", email, name, role, "loginMethod") values (${`pending:${randomUUID()}`}, ${email}, ${"Administrador principal"}, 'admin', 'pending') on conflict (email) do nothing`;
  const [user] = await sql`select role, "disabledAt", "workspaceOwnerId" from users where email = ${email}`;
  if (user.role !== "admin" || user.disabledAt || user.workspaceOwnerId) throw new Error("O cadastro existente precisa ser revisado; nenhuma permissão foi alterada.");
  const { data, error } = await client.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: new URL("/setup", process.env.PUBLIC_APP_URL).toString() } });
  if (error || !data.properties?.action_link) throw new Error("Não foi possível gerar o primeiro acesso.");
  await writeFile(".env.admin-access", data.properties.action_link + "\n", { mode: 0o600 });
  console.log("Acesso único salvo em .env.admin-access. Entregue privadamente ao administrador principal. Não publique este arquivo.");
} finally { await sql.end(); }
