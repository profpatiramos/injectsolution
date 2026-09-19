import type { Express } from "express";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { upsertUser, getUserByOpenId } from "./db";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { supabaseAdmin } from "./supabase";

export function registerSupabaseAuth(app: Express) {
  app.post("/api/auth/session", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    const expected = process.env.PUBLIC_APP_URL ? new URL(process.env.PUBLIC_APP_URL).origin : undefined;
    if (!origin || (expected ? origin !== expected : !/^http:\/\/localhost:\d+$/.test(origin))) {
      res.status(403).json({ error: "Origem de acesso inválida." }); return;
    }
    const parsed = z.object({ accessToken: z.string().min(20).max(12000) }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Sessão inválida." }); return; }
    try {
      const { data, error } = await supabaseAdmin().auth.getUser(parsed.data.accessToken);
      if (error || !data.user?.email || !data.user.email_confirmed_at) {
        res.status(401).json({ error: "Confirme seu acesso para entrar." }); return;
      }
      const identity = data.user;
      await upsertUser({ openId: identity.id, email: identity.email!, name: identity.user_metadata?.name || identity.email!, loginMethod: "supabase" });
      const user = await getUserByOpenId(identity.id);
      if (!user || user.disabledAt) { res.status(403).json({ error: "Acesso removido pelo administrador." }); return; }
      const duration = 7 * 24 * 60 * 60 * 1000;
      const token = await sdk.createSessionToken(user.openId, { name: user.name || user.email || "Usuário", expiresInMs: duration });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: duration });
      res.json({ success: true });
    } catch {
      res.status(403).json({ error: "Não foi possível entrar. Verifique seu acesso com o administrador." });
    }
  });
}
