import "dotenv/config";
import { registerSupabaseAuth } from "./supabaseAuth";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerBlingRoutes } from "./blingRoutes";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

export function createApplication() {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api/bling/webhook", express.raw({ type: "application/json", limit: "1mb" }));
  registerBlingRoutes(app);
  app.use(express.json({ limit: "4.4mb" }));
  app.use(express.urlencoded({ limit: "4.4mb", extended: true }));
  registerStorageProxy(app);
  if (process.env.OAUTH_SERVER_URL) registerOAuthRoutes(app);
  registerSupabaseAuth(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  return app;
}
