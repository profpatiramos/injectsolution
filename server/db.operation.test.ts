import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as unknown[][], writes: [] as unknown[], locks: 0 }));
vi.mock("postgres", () => ({ default: vi.fn() }));
vi.mock("drizzle-orm/postgres-js", () => {
  const db: any = {
    transaction: async (callback: (tx: any) => unknown) => callback(db),
    select: () => {
      const rows = state.rows.shift() ?? [];
      const chain: any = { from: () => chain, where: () => chain, limit: () => chain, orderBy: () => chain, for: () => { state.locks++; return Promise.resolve(rows); }, then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) };
      return chain;
    },
    update: () => ({ set: (value: unknown) => ({ where: async () => { state.writes.push(value); } }) }),
    insert: () => ({ values: (value: unknown) => { state.writes.push(value); return { returning: async () => [{ id: 9 }], then: (resolve: any) => Promise.resolve().then(resolve) }; } }),
    delete: () => ({ where: async () => { state.writes.push("delete"); } }),
  };
  return { drizzle: () => db };
});
import { addPhoto, finalizeOrder, markAllItems, removePhoto, startSeparation, updateOrderItem, updateOrder, upsertImportedOrder, addWorkspaceMember, removeWorkspaceMember, upsertUser } from "./db";

beforeEach(() => { process.env.DATABASE_URL = "postgres://test"; state.rows = []; state.writes = []; state.locks = 0; });
const order = { id: 1, ownerId: 10, status: "COM_DIVERGENCIA", finalizedAt: new Date() };

describe("bloqueios nas operações de persistência", () => {
  it("cadastra funcionário antes do primeiro login", async () => {
    state.rows = [[{ id: 10 }], []];
    await addWorkspaceMember(10, 10, { name: "Funcionário Teste", email: " TESTE@example.com ", role: "separador" });
    expect(state.writes[0]).toMatchObject({ email: "teste@example.com", role: "separador", workspaceOwnerId: 10, openId: expect.stringMatching(/^pending:/) });
  });
  it("atribui administração inicial ao e-mail configurado", async () => {
    state.rows = [[], []];
    await upsertUser({ openId: "oauth-root", email: "vpramos85@gmail.com", name: "Admin" });
    expect(state.writes[0]).toMatchObject({ role: "admin", workspaceOwnerId: null, openId: "oauth-root" });
  });
  it("vincula o primeiro login ao cadastro existente sem duplicar o histórico", async () => {
    state.rows = [[], [{ id: 20, openId: "pending:123", email: "teste@example.com", role: "admin", workspaceOwnerId: 10, disabledAt: null }]];
    await upsertUser({ openId: "oauth-real", email: "teste@example.com" });
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({ openId: "oauth-real" });
    expect(state.writes[0]).not.toHaveProperty("role");
    expect(state.writes[0]).not.toHaveProperty("workspaceOwnerId");
  });
  it("exclui acesso sem apagar identidade ou histórico", async () => {
    state.rows = [[{ id: 20, workspaceOwnerId: 10, name: "Funcionário Teste" }]];
    await removeWorkspaceMember(10, 10, 20);
    expect(state.writes[0]).toMatchObject({ role: "user", disabledAt: expect.any(Date) });
    expect(state.writes).not.toContain("delete");
  });
  it.each([{ id: 10, workspaceOwnerId: null }, { id: 30, workspaceOwnerId: 99 }])("protege administrador principal e outras equipes: $id", async target => {
    state.rows = [[target]];
    await expect(removeWorkspaceMember(10, 10, target.id)).rejects.toThrow();
    expect(state.writes).toEqual([]);
  });
  it("novo login não reativa funcionário excluído", async () => {
    state.rows = [[{ id: 20, openId: "oauth-real", workspaceOwnerId: 10, disabledAt: new Date() }]];
    await expect(upsertUser({ openId: "oauth-real", email: "teste@example.com" })).rejects.toThrow("removido");
    expect(state.writes).toEqual([]);
  });
  it("registra horário de recebimento e funcionário no servidor", async () => {
    state.rows = [[{ ...order, status: "EM_SEPARACAO", finalizedAt: null }]];
    const before = Date.now();
    await addPhoto(10, 11, { orderId: 1, kind: "CAIXA_ABERTA", storageKey: "x", url: "x", filename: "caixa.jpg", mimeType: "image/jpeg" });
    expect(state.writes[0]).toMatchObject({ kind: "CAIXA_ABERTA", uploadedByUserId: 11, capturedAt: expect.any(Date) });
    expect((state.writes[0] as { capturedAt: Date }).capturedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(state.writes[1]).toMatchObject({ actorUserId: 11, action: "FOTO_ADICIONADA", details: { kind: "CAIXA_ABERTA" } });
  });
  it("confirmação de pendências não ignora foto da caixa fechada", async () => {
    state.rows = [[{ ...order, finalizedAt: null }], [{ quantity: 1, quantitySeparated: 1, quantityChecked: 1, status: "CONFERIDO" }], [{ kind: "CAIXA_ABERTA" }, { kind: "CAIXA_ABERTA" }]];
    await expect(finalizeOrder(10, 11, 1, true)).rejects.toThrow("caixa fechada");
    expect(state.writes).toEqual([]);
  });
  it.each([
    ["item", () => updateOrderItem(10, 11, { orderId: 1, itemId: 2, quantitySeparated: 1, quantityChecked: 1, status: "CONFERIDO" })],
    ["lote", () => markAllItems(10, 11, 1, true)],
    ["reinício", () => startSeparation(10, 11, 1)],
    ["foto", () => addPhoto(10, 11, { orderId: 1, kind: "CAIXA_ABERTA", storageKey: "x", url: "x", filename: "x.jpg", mimeType: "image/jpeg" })],
    ["finalização repetida", () => finalizeOrder(10, 11, 1, true)],
  ] as const)("rejeita %s após finalização antes de escrever", async (_, action) => {
    state.rows = [[order]];
    await expect(action()).rejects.toThrow("finalizado");
    expect(state.writes).toEqual([]);
    expect(state.locks).toBe(1);
  });
  it("preserva a foto de um pedido finalizado com divergência", async () => {
    state.rows = [[{ id: 2, orderId: 1 }], [order]];
    await expect(removePhoto(10, 11, 2)).rejects.toThrow("finalizado");
    expect(state.writes).toEqual([]);
  });
  it("não deixa editar nem sincronizar uma separação em andamento", async () => {
    const active = { ...order, status: "EM_SEPARACAO", finalizedAt: null };
    const input = { blingOrderNumber: "1", customerName: "Teste", items: [] };
    state.rows = [[active]];
    await expect(updateOrder(10, 11, 1, input)).rejects.toThrow("já começou");
    state.rows = [[active], [active]];
    await expect(upsertImportedOrder(10, 11, input)).rejects.toThrow("já começou");
    expect(state.writes).toEqual([]);
  });
  it("marcação em lote mantém divergências e exige conferência posterior", async () => {
    state.rows = [[{ ...order, finalizedAt: null, status: "EM_SEPARACAO" }], [{ id: 2, status: "PENDENTE", quantity: 3 }, { id: 3, status: "DIVERGENCIA", quantity: 5 }]];
    await markAllItems(10, 11, 1, true);
    expect(state.writes[0]).toMatchObject({ status: "SEPARADO", quantitySeparated: 3, quantityChecked: 0 });
    expect(state.writes).toHaveLength(3);
  });
  it("não finaliza sem foto, mesmo com confirmação de pendências", async () => {
    state.rows = [[{ ...order, finalizedAt: null }], [{ quantity: 1, quantitySeparated: 1, quantityChecked: 1, status: "CONFERIDO" }], []];
    await expect(finalizeOrder(10, 11, 1, true)).rejects.toThrow("foto");
    expect(state.writes).toEqual([]);
  });
});
