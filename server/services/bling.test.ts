import { describe, expect, it } from "vitest";
import { normalizeBlingOrder, normalizeBlingProduct } from "./bling";

describe("adaptador de pedidos Bling", () => {
  it("importa somente identificação e cliente sem telefone, observações ou itens", () => {
    const result = normalizeBlingOrder({
      id: 987,
      numero: 100123,
      data: "2026-08-27",
      observacoes: "Separar com atenção",
      contato: { nome: "Cliente Teste", celular: "11999999999" },
      itens: [{ codigo: "CAB-01", descricao: "Cabo principal", quantidade: 2, unidade: "UN" }],
    });
    expect(result).toEqual({ blingOrderId: "987", blingOrderNumber: "100123", customerName: "Cliente Teste", items: [] });
  });

  it("aceita pedidos resumidos da listagem do Bling", () => {
    expect(normalizeBlingOrder({ id: 1, numero: 10, contato: { nome: "Cliente" } }).items).toEqual([]);
  });
  it("recusa um pedido sem identificação", () => {
    expect(() => normalizeBlingOrder({})).toThrow("sem número");
  });
  it("mantém produto, SKU e unidade sem dados comerciais", () => {
    expect(normalizeBlingProduct({ id: 1, nome: "Produto", codigo: "ABC", unidade: "PAR" })).toEqual({ externalId: "1", name: "Produto", sku: "ABC", unit: "PAR" });
    expect(normalizeBlingProduct({ id: 2, nome: "Sem unidade" }).unit).toBe("OUTRO");
  });
});
