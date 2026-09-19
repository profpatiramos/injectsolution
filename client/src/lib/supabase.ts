import { createClient } from "@supabase/supabase-js";
let client: ReturnType<typeof createClient> | undefined;
let googleClient: ReturnType<typeof createClient> | undefined;
export function getGoogleAuth() {
  if (!googleClient) googleClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { flowType: "pkce", storage: window.sessionStorage, storageKey: "injectsolution-google", persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return googleClient;
}
export async function startGoogleLogin() {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY } });
  if (!response.ok || !(await response.json()).external?.google) throw new Error("A entrada com Google ainda está sendo ativada. Use seu e-mail e senha por enquanto.");
  const { error } = await getGoogleAuth().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "openid email profile", queryParams: { prompt: "select_account" } } });
  if (error) throw new Error("Não foi possível iniciar o acesso com Google. Tente novamente.");
}
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
  if (googleClient) await googleClient.auth.signOut({ scope: "local" });
  window.location.replace("/app");
}
