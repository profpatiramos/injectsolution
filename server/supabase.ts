import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("A conexão segura com o Supabase ainda não foi configurada.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function generateAccessLink(email: string) {
  const origin = process.env.PUBLIC_APP_URL;
  if (!origin) throw new Error("Configure o endereço público do aplicativo antes de gerar acessos.");
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type: "magiclink", email,
    options: { redirectTo: new URL("/setup", origin).toString() },
  });
  if (error || !data.properties?.action_link) throw new Error("Não foi possível gerar o acesso. Tente novamente.");
  return { accessLink: data.properties.action_link };
}
