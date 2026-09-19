import { describe, expect, it } from "vitest";
import { normalizeBlingOrder } from "./bling";

describe("adaptador de pedidos Bling", () => {
  it("converte pedido e itens para o checklist operacional", () => {
    const result = normalizeBlingOrder({
      id: 987,
      numero: 100123,
      data: "2026-08-27",
      observacoes: "Separar com atenção",
      contato: { nome: "Cliente Teste", celular: "11999999999" },
      itens: [{ codigo: "CAB-01", descricao: "Cabo principal", quantidade: 2, unidade: "UN" }],
    });
    expect(result).toMatchObject({ blingOrderId: "987", blingOrderNumber: "100123", customerName: "Cliente Teste", customerPhone: "11999999999" });
    expect(result.items[0]).toMatchObject({ sku: "CAB-01", description: "Cabo principal", quantity: 2, unit: "UN", categoryName: "Outros" });
  });

  it("falha quando o pedido não tem itens", () => {
    expect(() => normalizeBlingOrder({ id: 1, numero: 10, itens: [] })).toThrow("não possui itens");
  });
});
