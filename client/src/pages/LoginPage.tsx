import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { getSupabase, openAppSession, startGoogleLogin } from "@/lib/supabase";

export default function LoginPage() {
  const setup = window.location.pathname === "/setup";
  const recovery = window.location.pathname === "/recover";
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!setup) return;
    try {
      void getSupabase().auth.getSession().then(({ data, error }) => {
        window.history.replaceState(null, "", "/setup");
        if (error || !data.session) setError("Este link expirou ou já foi utilizado. Solicite um novo ao administrador.");
        else { setToken(data.session.access_token); setEmail(data.session.user.email || ""); }
      });
    } catch (error) { setError((error as Error).message); }
  }, [setup]);
  return <main className="grid min-h-dvh place-items-center bg-[#0b0b0c] px-5 py-12">
    <section className="w-full max-w-md"><BrandMark /><form className="surface-card mt-8 space-y-5 p-7" onSubmit={async event => {
      event.preventDefault(); if (busy) return; setError(""); setBusy(true);
      try {
        if (recovery) {
          const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/setup` });
          if (error) throw new Error("Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos ou solicite um link ao administrador.");
          setSent(true);
        } else if (setup) {
          if (!token) throw new Error("Solicite um novo link de acesso ao administrador.");
          if (password !== confirm) throw new Error("As senhas precisam ser iguais.");
          const { error } = await getSupabase().auth.updateUser({ password });
          if (error) throw new Error("Não foi possível definir a senha. Use pelo menos 12 caracteres.");
          const { data } = await getSupabase().auth.getSession();
          await openAppSession(data.session?.access_token || token);
        } else {
          const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
          if (error || !data.session) throw new Error("E-mail ou senha incorretos. Use Esqueci minha senha para recuperar o acesso.");
          await openAppSession(data.session.access_token);
        }
      } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
    }}>
      <h1 className="font-display text-3xl font-bold uppercase">{setup ? "Defina sua senha" : recovery ? "Recuperar senha" : "Entrar na operação"}</h1>
      <p className="text-sm text-[#65656d]">{setup ? "Crie uma senha pessoal para acessar o InjectSolution." : recovery ? "Informe seu e-mail para receber um link de redefinição." : "Use o e-mail cadastrado pelo administrador."}</p>
      {!setup && !recovery && <><button type="button" disabled={busy} className="inject-outline-button flex min-h-12 w-full items-center justify-center gap-3 px-4" onClick={async () => { setBusy(true); setError(""); try { await startGoogleLogin(); } catch (error) { setError((error as Error).message); setBusy(false); } }}><span aria-hidden="true" className="text-xl font-bold">G</span>Continuar com Google</button><div className="text-center text-xs text-[#65656d]">ou entre com e-mail e senha</div></>}
      <label className="block text-sm font-bold">E-mail<input className="field mt-2" type="email" autoComplete="username" required value={email} readOnly={setup} onChange={event => setEmail(event.target.value)} /></label>
      {!recovery && <label className="block text-sm font-bold">Senha<input className="field mt-2" type="password" autoComplete={setup ? "new-password" : "current-password"} required minLength={setup ? 12 : 1} value={password} onChange={event => setPassword(event.target.value)} /></label>}
      {setup && <label className="block text-sm font-bold">Confirme a senha<input className="field mt-2" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={event => setConfirm(event.target.value)} /><span className="mt-2 block text-xs font-normal">Use pelo menos 12 caracteres.</span></label>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {sent && <p role="status" className="text-sm text-green-800">Se este e-mail tiver uma conta, você receberá um link para redefinir sua senha. Confira também a pasta de spam.</p>}
      <button type="submit" disabled={busy || sent || (setup && !token)} className="inject-button min-h-12 w-full px-4">{busy ? "Aguarde…" : setup ? "Salvar senha e entrar" : recovery ? sent ? "Solicitação recebida" : "Enviar link de recuperação" : "Entrar"}</button>
      {!setup && !recovery && <a href="/recover" className="block text-center text-sm font-bold text-[#e31937]">Esqueci minha senha</a>}
      {(recovery || setup) && <a href="/login" className="block text-center text-sm text-[#65656d]">Voltar ao login</a>}
      {!setup && !recovery && <p className="text-xs text-[#65656d]">Primeiro acesso? Use sua conta Google cadastrada ou o link fornecido pelo administrador.</p>}
    </form></section>
  </main>;
}
