import { evidenceKinds } from "../shared/evidence";
import { randomUUID } from "node:crypto";
import { workspaceOwner } from "../shared/access";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router, separadorProcedure } from "./_core/trpc";
import {
  addPhoto,
  addWorkspaceMember,
  removeWorkspaceMember,
  assertPhotoUploadAllowed,
  createCategory,
  getBlingIntegration,
  saveBlingIntegration,
  listWorkspaceMembers,
  listWorkspaceActivity,
  setUserRole,
  createOrder,
  createProduct,
  finalizeOrder,
  getDashboard,
  getOrderDetail,
  listCategories,
  listOrders,
  listProducts,
  markAllItems,
  removeOrder,
  removePhoto,
  startSeparation,
  updateOrder,
  updateOrderItem,
} from "./db";
import { storagePut } from "./storage";
import { createBlingOAuthState, getBlingAuthorizationUrl, syncBlingOrders } from "./services/bling";


const orderStatusSchema = z.enum([
  "NOVO",
  "AGUARDANDO_SEPARACAO",
  "EM_SEPARACAO",
  "SEPARADO",
  "CONFERIDO",
  "COM_DIVERGENCIA",
  "PRONTO",
]);
const itemStatusSchema = z.enum(["PENDENTE", "SEPARADO", "CONFERIDO", "DIVERGENCIA", "NAO_ENCONTRADO"]);
const unitSchema = z.enum(["UN", "METRO", "JOGO", "PAR", "KIT", "CONJUNTO", "OUTRO"]);

const orderItemSchema = z.object({
  productId: z.number().int().positive().optional(),
  sku: z.string().max(120).optional(),
  description: z.string().trim().min(2, "Informe a descrição do item.").max(320),
  categoryName: z.string().trim().min(2, "Informe uma categoria.").max(120),
  quantity: z.number().int().min(1, "A quantidade deve ser maior que zero."),
  unit: unitSchema,
  note: z.string().max(1000).optional(),
});

const orderInputSchema = z.object({
  blingOrderNumber: z.string().trim().min(1, "Informe o número do pedido.").max(120),
  blingOrderId: z.string().max(120).optional(),
  customerName: z.string().trim().min(2, "Informe o cliente.").max(240),
  customerPhone: z.string().max(60).optional(),
  customerNote: z.string().max(2000).optional(),
  vehicleBrand: z.string().max(120).optional(),
  vehicleModel: z.string().max(160).optional(),
  vehicleYear: z.number().int().min(1900).max(2100).optional(),
  vehicleEngine: z.string().max(160).optional(),
  vehicleCylinders: z.string().max(80).optional(),
  vehicleConfiguration: z.string().max(240).optional(),
  vehicleNotes: z.string().max(2000).optional(),
  items: z.array(orderItemSchema).min(1, "Adicione ao menos um item ao pedido."),
});

function serverError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Não foi possível concluir esta operação.";
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    overview: separadorProcedure.query(({ ctx }) => getDashboard(workspaceOwner(ctx.user))),
  }),
  orders: router({
    list: separadorProcedure
      .input(z.object({ search: z.string().max(120).optional(), status: orderStatusSchema.optional() }).optional())
      .query(({ ctx, input }) => listOrders(workspaceOwner(ctx.user), input)),
    get: separadorProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try {
        return await getOrderDetail(workspaceOwner(ctx.user), input.id);
      } catch (error) {
        return serverError(error);
      }
    }),
    create: adminProcedure.input(orderInputSchema).mutation(async ({ ctx, input }) => {
      try {
        return await createOrder(workspaceOwner(ctx.user), ctx.user.id, input);
      } catch (error) {
        return serverError(error);
      }
    }),
    update: adminProcedure.input(orderInputSchema.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;
        return await updateOrder(workspaceOwner(ctx.user), ctx.user.id, id, data);
      } catch (error) {
        return serverError(error);
      }
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await removeOrder(workspaceOwner(ctx.user), ctx.user.id, input.id);
      } catch (error) {
        return serverError(error);
      }
    }),
    startSeparation: separadorProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await startSeparation(workspaceOwner(ctx.user), ctx.user.id, input.orderId);
      } catch (error) {
        return serverError(error);
      }
    }),
    markAll: separadorProcedure.input(z.object({ orderId: z.number().int().positive(), mark: z.boolean() })).mutation(async ({ ctx, input }) => {
      try {
        return await markAllItems(workspaceOwner(ctx.user), ctx.user.id, input.orderId, input.mark);
      } catch (error) {
        return serverError(error);
      }
    }),
    updateItem: separadorProcedure
      .input(z.object({ orderId: z.number().int().positive(), itemId: z.number().int().positive(), quantitySeparated: z.number().int().min(0), quantityChecked: z.number().int().min(0), status: itemStatusSchema }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await updateOrderItem(workspaceOwner(ctx.user), ctx.user.id, input);
        } catch (error) {
          return serverError(error);
        }
      }),
    finalize: separadorProcedure.input(z.object({ orderId: z.number().int().positive(), allowPending: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
      try {
        return await finalizeOrder(workspaceOwner(ctx.user), ctx.user.id, input.orderId, input.allowPending);
      } catch (error) {
        return serverError(error);
      }
    }),
  }),
  photos: router({
    upload: separadorProcedure
      .input(z.object({ orderId: z.number().int().positive(), kind: z.enum(evidenceKinds), filename: z.string().min(1).max(240), mimeType: z.string().regex(/^image\//, "Selecione uma imagem válida."), base64: z.string().min(20) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const raw = input.base64.includes(",") ? input.base64.split(",").pop()! : input.base64;
          const bytes = Buffer.from(raw, "base64");
          if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new Error("A imagem preparada deve ter no máximo 3 MB.");
          const extension = input.filename.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
          const workspaceOwnerId = workspaceOwner(ctx.user);
          await assertPhotoUploadAllowed(workspaceOwnerId, input.orderId);
          const { key, url } = await storagePut(`orders/${workspaceOwnerId}/${input.orderId}/${randomUUID()}.${extension}`, bytes, input.mimeType);
          return await addPhoto(workspaceOwnerId, ctx.user.id, { kind: input.kind, orderId: input.orderId, storageKey: key, url, filename: input.filename, mimeType: input.mimeType });
        } catch (error) {
          return serverError(error);
        }
      }),
    remove: separadorProcedure.input(z.object({ photoId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await removePhoto(workspaceOwner(ctx.user), ctx.user.id, input.photoId);
      } catch (error) {
        return serverError(error);
      }
    }),
  }),
  catalog: router({
    categories: separadorProcedure.query(({ ctx }) => listCategories(workspaceOwner(ctx.user))),
    createCategory: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(120) })).mutation(async ({ ctx, input }) => {
      try {
        return await createCategory(workspaceOwner(ctx.user), ctx.user.id, input.name);
      } catch (error) {
        return serverError(error);
      }
    }),
    products: separadorProcedure.input(z.object({ search: z.string().max(120).optional() }).optional()).query(({ ctx, input }) => listProducts(workspaceOwner(ctx.user), input?.search)),
    createProduct: adminProcedure.input(z.object({ categoryId: z.number().int().positive().optional(), sku: z.string().max(120).optional(), externalId: z.string().max(120).optional(), name: z.string().trim().min(2).max(240), description: z.string().max(2000).optional(), unit: unitSchema, note: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      try {
        return await createProduct(workspaceOwner(ctx.user), ctx.user.id, input);
      } catch (error) {
        return serverError(error);
      }
    }),
  }),
  admin: router({
    activity: adminProcedure.query(({ ctx }) => listWorkspaceActivity(workspaceOwner(ctx.user))),
    removeMember: adminProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { return await removeWorkspaceMember(workspaceOwner(ctx.user), ctx.user.id, input.userId); } catch (error) { return serverError(error); }
    }),
    addMember: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(200), email: z.string().email(), role: z.enum(["admin", "separador"]) })).mutation(async ({ ctx, input }) => {
      try { return await addWorkspaceMember(workspaceOwner(ctx.user), ctx.user.id, input); } catch (error) { return serverError(error); }
    }),
    members: adminProcedure.query(({ ctx }) => listWorkspaceMembers(workspaceOwner(ctx.user))),
    setMemberRole: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin", "separador"]) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await setUserRole(workspaceOwner(ctx.user), ctx.user.id, input.userId, input.role);
        } catch (error) {
          return serverError(error);
        }
      }),
  }),
  bling: router({
    status: adminProcedure.query(async ({ ctx }) => {
      const integration = await getBlingIntegration(workspaceOwner(ctx.user));
      return integration
        ? { status: integration.status, externalAccountId: integration.externalAccountId, lastSyncedAt: integration.lastSyncedAt }
        : { status: "PENDENTE", externalAccountId: null, lastSyncedAt: null };
    }),
    connect: adminProcedure.mutation(async ({ ctx }) => {
      try {
        const state = createBlingOAuthState();
        await saveBlingIntegration(workspaceOwner(ctx.user), { status: "AUTORIZACAO_PENDENTE", oauthState: state });
        return { authorizationUrl: getBlingAuthorizationUrl(state) };
      } catch (error) {
        return serverError(error);
      }
    }),
    sync: adminProcedure
      .input(z.object({ sinceDays: z.number().int().min(1).max(365).default(30) }).optional())
      .mutation(async ({ ctx, input }) => {
        try {
          return await syncBlingOrders(workspaceOwner(ctx.user), ctx.user.id, input);
        } catch (error) {
          return serverError(error);
        }
      }),
    disconnect: adminProcedure.mutation(async ({ ctx }) => {
      await saveBlingIntegration(workspaceOwner(ctx.user), { status: "PENDENTE", accessToken: null, refreshToken: null, accessTokenExpiresAt: null, oauthState: null });
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
