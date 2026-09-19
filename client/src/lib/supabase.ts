import { createClient } from "@supabase/supabase-js";
let client: ReturnType<typeof createClient> | undefined;
export function getSupabase() {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("O acesso ainda está sendo configurado. Contate o administrador.");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true } });
  }
  return client;
}
export async function openAppSession(accessToken: string) {
  const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
  if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Não foi possível entrar."); }
  await getSupabase().auth.signOut({ scope: "local" });
  window.location.replace("/app");
}
