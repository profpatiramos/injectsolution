import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../server/supabase";

if (process.env.ALLOW_LIVE_TESTS !== "yes") throw new Error("Configure ALLOW_LIVE_TESTS=yes.");
const service = supabaseAdmin();
const email = `recovery-${randomUUID()}@example.invalid`;
const oldPassword = randomUUID() + randomUUID();
const newPassword = randomUUID() + randomUUID();
const client = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
let userId: string | undefined;
try {
  const created = await service.auth.admin.createUser({ email, password: oldPassword, email_confirm: true });
  assert.ifError(created.error);
  userId = created.data.user!.id;
  // Generate a real recovery token without sending email or touching existing users.
  const link = await service.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: "https://injectsolution.vercel.app/setup" } });
  assert.ifError(link.error);
  const auth = client();
  const recovered = await auth.auth.verifyOtp({ type: "recovery", token_hash: link.data.properties.hashed_token });
  assert.ifError(recovered.error);
  assert(recovered.data.session, "A recuperação deve criar uma sessão temporária");
  const changed = await auth.auth.updateUser({ password: newPassword });
  assert.ifError(changed.error);
  assert((await client().auth.signInWithPassword({ email, password: oldPassword })).error, "A senha antiga deve ser recusada");
  assert.ifError((await client().auth.signInWithPassword({ email, password: newPassword })).error);
  assert((await client().auth.verifyOtp({ type: "recovery", token_hash: link.data.properties.hashed_token })).error, "O link não pode ser reutilizado");
  console.log("PASS: recuperação real, nova senha, rejeição da senha antiga e link de uso único. Entrega por e-mail não faz parte deste teste.");
} finally {
  if (userId) { const result = await service.auth.admin.deleteUser(userId); assert.ifError(result.error); }
  console.log("Usuário sintético de recuperação removido.");
}
