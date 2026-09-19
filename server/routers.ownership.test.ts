import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  addPhoto: vi.fn(),
  assertPhotoUploadAllowed: vi.fn(),
  addWorkspaceMember: vi.fn(),
  getBlingIntegration: vi.fn(),
  saveBlingIntegration: vi.fn(),
  listWorkspaceMembers: vi.fn(),
  setUserRole: vi.fn(),
  createCategory: vi.fn(),
  createOrder: vi.fn(),
  createProduct: vi.fn(),
  finalizeOrder: vi.fn(),
  getDashboard: vi.fn(),
  getOrderDetail: vi.fn(),
  listCategories: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  markAllItems: vi.fn(),
  removeOrder: vi.fn(),
  removePhoto: vi.fn(),
  startSeparation: vi.fn(),
  updateOrder: vi.fn(),
  updateOrderItem: vi.fn(),
}));

vi.mock("./storage", () => ({ storagePut: vi.fn() }));

import { getOrderDetail, listOrders, startSeparation, assertPhotoUploadAllowed, createOrder } from "./db";
import { storagePut } from "./storage";
import { appRouter } from "./routers";

function contextFor(userId: number, role: "user" | "admin" | "separador" = "user", workspaceOwnerId?: number): TrpcContext {
  return {
    user: {
      id: userId,
      disabledAt: null,
      openId: `user-${userId}`,
      name: "Operador",
      email: "operador@injectsolution.test",
      loginMethod: "test",
      role,
      workspaceOwnerId: workspaceOwnerId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("isolamento por usuário nas rotas de pedidos", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["user", "separador"] as const)("bloqueia leitura sem acesso à equipe: %s", async role => {
    const caller = appRouter.createCaller(contextFor(41, role));
    await expect(caller.orders.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listOrders).not.toHaveBeenCalled();
  });

  it("administrador promovido consulta pedidos da mesma equipe", async () => {
    await appRouter.createCaller(contextFor(41, "admin", 10)).orders.list();
    expect(listOrders).toHaveBeenCalledWith(10, undefined);
  });

  it("separador não pode excluir pedidos nem mudar perfis", async () => {
    const caller = appRouter.createCaller(contextFor(41, "separador", 10));
    await expect(caller.orders.remove({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.setMemberRole({ userId: 41, role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.removeMember({ userId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.addMember({ name: "Teste", email: "teste@example.com", role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("verifica o acesso ao pedido antes de enviar a foto ao armazenamento", async () => {
    vi.mocked(assertPhotoUploadAllowed).mockRejectedValueOnce(new Error("Pedido sem permissão."));
    const caller = appRouter.createCaller(contextFor(41, "separador", 10));
    await expect(caller.photos.upload({ orderId: 900, kind: "CAIXA_ABERTA", filename: "foto.jpg", mimeType: "image/jpeg", base64: "aGVsbG93b3JsZGhlbGxvd29ybGQ=" })).rejects.toThrow("sem permissão");
    expect(storagePut).not.toHaveBeenCalled();
  });

  it("lista somente no escopo do usuário autenticado", async () => {
    vi.mocked(listOrders).mockResolvedValue([] as never);
    const caller = appRouter.createCaller(contextFor(41, "admin"));

    await caller.orders.list({ search: "Opala" });

    expect(listOrders).toHaveBeenCalledWith(41, { search: "Opala" });
  });

  it("bloqueia o cadastro de categoria para o perfil separador", async () => {
    const caller = appRouter.createCaller(contextFor(41, "separador", 10));
    await expect(caller.catalog.createCategory({ name: "Ignição" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("usa o espaço do administrador ao iniciar uma separação", async () => {
    const caller = appRouter.createCaller(contextFor(41, "separador", 10));
    await caller.orders.startSeparation({ orderId: 812 });
    expect(startSeparation).toHaveBeenCalledWith(10, 41, 812);
  });

  it("abre detalhes usando o proprietário autenticado como escopo", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({} as never);
    const caller = appRouter.createCaller(contextFor(97, "admin"));

    await caller.orders.get({ id: 812 });

    expect(getOrderDetail).toHaveBeenCalledWith(97, 812);
  });
});
