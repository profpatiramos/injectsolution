import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../db", () => ({ getBlingIntegration: vi.fn(), saveBlingIntegration: vi.fn(), upsertImportedOrder: vi.fn(), upsertBlingProduct: vi.fn() }));
import { getBlingIntegration } from "../db";
import { findBlingOrder } from "./bling";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
  vi.mocked(getBlingIntegration).mockResolvedValue({ accessToken: "synthetic-token", accessTokenExpiresAt: null } as never);
});
afterEach(() => vi.unstubAllGlobals());
describe("busca individual no Bling", () => {
  it("consulta o número na conta da equipe e retorna somente identificação e cliente", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 12, numero: 123, contato: { nome: "Cliente", telefone: "private" }, total: 1234, itens: [{ descricao: "Privado" }] }] })));
    expect(await findBlingOrder(10, "00123")).toEqual({ blingOrderId: "12", blingOrderNumber: "123", customerName: "Cliente" });
    expect(getBlingIntegration).toHaveBeenCalledWith(10);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("numero")).toBe("00123");
  });
  it("não preenche dados de um pedido diferente se o filtro remoto for ignorado", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 1, numero: 456, contato: { nome: "Outro" } }] })));
    await expect(findBlingOrder(10, "123")).rejects.toThrow("não encontrado");
  });
  it("recusa entrada inválida sem consultar o Bling", async () => {
    await expect(findBlingOrder(10, "abc")).rejects.toThrow("dígitos");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("orienta conexão quando não há token", async () => {
    vi.mocked(getBlingIntegration).mockResolvedValue(undefined);
    await expect(findBlingOrder(10, "123")).rejects.toThrow("não está conectada");
  });
  it("não expõe a resposta bruta de erro do provedor", async () => {
    fetchMock.mockResolvedValue(new Response("private provider response", { status: 403 }));
    await expect(findBlingOrder(10, "123")).rejects.toThrow("não tem permissão");
  });
});
