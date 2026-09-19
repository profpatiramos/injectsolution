import { workspaceOwner } from "../shared/access";
import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getBlingIntegrationByState, saveBlingIntegration } from "./db";
import { exchangeBlingCode, verifyBlingWebhookSignature } from "./services/bling";

function queryString(req: Request, key: string) {
  return typeof req.query[key] === "string" ? req.query[key] : undefined;
}

export function registerBlingRoutes(app: Express) {
  app.get("/api/bling/oauth/callback", async (req, res) => {
    const code = queryString(req, "code");
    const state = queryString(req, "state");
    if (!code || !state) {
      res.status(400).send("Autorização do Bling incompleta.");
      return;
    }
    try {
      const integration = await getBlingIntegrationByState(state);
      if (!integration) {
        res.status(403).send("Estado de autorização inválido ou expirado.");
        return;
      }
      const user = await sdk.authenticateRequest(req);
      if (workspaceOwner(user) !== integration.ownerId || user.role !== "admin") {
        res.status(403).send("Somente o administrador que iniciou a conexão pode concluí-la.");
        return;
      }
      const token = await exchangeBlingCode(code);
      await saveBlingIntegration(workspaceOwner(user), {
        status: "CONECTADO",
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? integration.refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + Math.max(60, token.expires_in ?? 21600) * 1000),
        oauthState: null,
      });
      res.redirect(302, "/admin?connected=1");
    } catch (error) {
      console.error("[Bling] OAuth callback failed", error);
      res.status(500).send("Não foi possível concluir a conexão com o Bling.");
    }
  });

  app.post("/api/bling/webhook", async (req: Request, res: Response) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const signature = req.header("X-Bling-Signature-256");
    if (!verifyBlingWebhookSignature(body, signature)) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }
    // O webhook apenas confirma o recebimento. A sincronização continua sob demanda
    // no painel, evitando que o Bling aguarde o processamento completo por mais de 5 s.
    res.status(204).send();
  });
}
