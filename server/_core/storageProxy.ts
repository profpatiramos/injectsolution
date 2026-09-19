import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";
import { sdk } from "./sdk";
import { canReadOrderPhoto } from "../db";
import { hasOperationAccess, workspaceOwner } from "../../shared/access";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // Only the public product illustration is accessible without a session.
    if (key !== "injectsolution-quadrijet_5228ddb0.webp") {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!hasOperationAccess(user) || !(await canReadOrderPhoto(workspaceOwner(user), key))) {
          res.status(403).send("Sem acesso a esta foto.");
          return;
        }
      } catch {
        res.status(401).send("Entre no sistema para visualizar a foto.");
        return;
      }
    }

    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch {
      res.status(502).send("Foto indisponível. Tente novamente.");
    }
  });
}
