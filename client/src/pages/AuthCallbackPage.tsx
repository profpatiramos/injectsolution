import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { getGoogleAuth, openAppSession } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    window.history.replaceState(null, "", "/auth/callback");
    if (!code || params.has("error")) { setError("A entrada com Google foi cancelada ou expirou. Tente novamente."); return; }
    void (async () => {
      try {
        const { data, error } = await getGoogleAuth().auth.exchangeCodeForSession(code);
        if (error || !data.session) throw new Error("Não foi possível confirmar o acesso. Inicie novamente neste navegador.");
        await openAppSession(data.session.access_token);
      } catch (error) { setError((error as Error).message); }
    })();
  }, []);
  return <main className="grid min-h-dvh place-items-center bg-[#0b0b0c] px-5"><section className="w-full max-w-md"><BrandMark /><div className="surface-card mt-8 space-y-5 p-7"><h1 className="font-display text-3xl font-bold uppercase">{error ? "Vamos tentar novamente" : "Confirmando seu acesso"}</h1><p role={error ? "alert" : "status"} className="text-sm">{error || "Aguarde enquanto conectamos sua conta Google ao InjectSolution."}</p>{error && <a href="/login" className="inject-button flex min-h-12 items-center justify-center">Voltar ao login</a>}</div></section></main>;
}
