import { createHash, randomBytes } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auditLogs, orders, orderMeasurements } from "../drizzle/schema";
import { workspaceOwner } from "../shared/access";
import { measurementConfigSchema, measurementResponseSchema, validateMeasurementResponse } from "../shared/measurements";
import { getDb } from "./db";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const orderInput = z.object({ orderId: z.number().int().positive() });
async function database() { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." }); return db; }
function unavailable(): never { throw new TRPCError({ code: "NOT_FOUND", message: "Este link expirou, foi cancelado ou não está disponível. Solicite um novo link à InjectSolution." }); }
function view(row: typeof orderMeasurements.$inferSelect) { return { config: row.config, response: row.response, revision: row.revision, expiresAt: row.expiresAt, submittedAt: row.submittedAt }; }
export const measurementRouter = router({
  get: adminProcedure.input(orderInput).query(async ({ ctx, input }) => {
    const db = await database(); const [row] = await db.select().from(orderMeasurements).where(and(eq(orderMeasurements.orderId, input.orderId), eq(orderMeasurements.ownerId, workspaceOwner(ctx.user))));
    return row ? view(row) : null;
  }),
  issue: adminProcedure.input(orderInput.extend({ config: measurementConfigSchema.optional() })).mutation(async ({ ctx, input }) => {
    const db = await database(); const ownerId = workspaceOwner(ctx.user);
    return db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.ownerId, ownerId))).for("update");
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
      const [old] = await tx.select().from(orderMeasurements).where(eq(orderMeasurements.orderId, order.id)).for("update");
      if (!old && !input.config) throw new TRPCError({ code: "BAD_REQUEST", message: "Prepare as medidas padrão antes de gerar os links." });
      const customerToken = randomBytes(32).toString("hex"); const supplierToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const values = { ownerId, orderId: order.id, config: input.config ?? old!.config, customerHash: hash(customerToken), supplierHash: hash(supplierToken), expiresAt, updatedAt: new Date(), revision: (old?.revision ?? 0) + 1, ...(input.config ? { response: null, submittedAt: null } : {}) };
      if (old) await tx.update(orderMeasurements).set(values).where(eq(orderMeasurements.id, old.id)); else await tx.insert(orderMeasurements).values(values);
      await tx.insert(auditLogs).values({ ownerId, orderId: order.id, actorUserId: ctx.user.id, action: "CHICOTE_LINKS_GERADOS", details: { number: order.blingOrderNumber, expiresAt: expiresAt.toISOString(), reset: Boolean(input.config), config: values.config } });
      return { customerToken, supplierToken, expiresAt };
    });
  }),
  revoke: adminProcedure.input(orderInput).mutation(async ({ ctx, input }) => {
    const db = await database(); const ownerId = workspaceOwner(ctx.user);
    await db.transaction(async tx => {
      const [row] = await tx.select().from(orderMeasurements).where(and(eq(orderMeasurements.orderId, input.orderId), eq(orderMeasurements.ownerId, ownerId))).for("update");
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Ficha não encontrada." });
      await tx.update(orderMeasurements).set({ customerHash: null, supplierHash: null, expiresAt: new Date(), revision: row.revision + 1 }).where(eq(orderMeasurements.id, row.id));
      await tx.insert(auditLogs).values({ ownerId, orderId: input.orderId, actorUserId: ctx.user.id, action: "CHICOTE_LINKS_CANCELADOS" });
    }); return { success: true };
  }),
  read: publicProcedure.input(z.object({ token: tokenSchema })).mutation(async ({ ctx, input }) => {
    ctx.res.setHeader("Cache-Control", "no-store"); const db = await database(); const digest = hash(input.token);
    const [result] = await db.select({ sheet: orderMeasurements, number: orders.blingOrderNumber, vehicle: orders.vehicleModel, year: orders.vehicleYear, engine: orders.vehicleEngine }).from(orderMeasurements).innerJoin(orders, eq(orders.id, orderMeasurements.orderId)).where(or(eq(orderMeasurements.customerHash, digest), eq(orderMeasurements.supplierHash, digest)));
    if (!result || !result.sheet.expiresAt || result.sheet.expiresAt.getTime() <= Date.now()) unavailable();
    return { ...view(result.sheet), orderNumber: result.number, vehicle: result.vehicle, year: result.year, engine: result.engine, mode: result.sheet.customerHash === digest ? "customer" as const : "supplier" as const };
  }),
  submit: publicProcedure.input(z.object({ token: tokenSchema, revision: z.number().int().nonnegative(), response: measurementResponseSchema })).mutation(async ({ ctx, input }) => {
    ctx.res.setHeader("Cache-Control", "no-store"); const db = await database();
    return db.transaction(async tx => {
      const [row] = await tx.select().from(orderMeasurements).where(eq(orderMeasurements.customerHash, hash(input.token))).for("update");
      if (!row || !row.expiresAt || row.expiresAt.getTime() <= Date.now()) unavailable();
      if (row.revision !== input.revision) throw new TRPCError({ code: "CONFLICT", message: "Esta ficha foi atualizada. Recarregue antes de enviar novamente." });
      let response; try { response = validateMeasurementResponse(row.config, input.response); } catch (e) { throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message }); }
      const [order] = await tx.select({ number: orders.blingOrderNumber }).from(orders).where(eq(orders.id, row.orderId));
      if (!order) unavailable();
      const submittedAt = new Date();
      await tx.update(orderMeasurements).set({ response, submittedAt, updatedAt: submittedAt, revision: row.revision + 1 }).where(eq(orderMeasurements.id, row.id));
      await tx.insert(auditLogs).values({ ownerId: row.ownerId, orderId: row.orderId, actorUserId: 0, action: "CHICOTE_RESPONDIDO", details: { number: order.number, responsible: response.responsible, config: row.config, response, revision: row.revision + 1 } });
      return { revision: row.revision + 1, submittedAt };
    });
  }),
});
