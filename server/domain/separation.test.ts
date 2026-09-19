import { describe, expect, it } from "vitest";
import { deriveItemStatus, evaluateFinalization } from "./separation";

describe("regras de conferência da separação", () => {
  it("converte automaticamente uma quantidade parcial em divergência", () => {
    expect(deriveItemStatus({ quantity: 10, quantitySeparated: 8, quantityChecked: 8, status: "CONFERIDO" })).toBe("DIVERGENCIA");
  });

  it("permite pedido pronto apenas quando todos os itens são conferidos e existe foto", () => {
    const result = evaluateFinalization([{ quantity: 1, quantitySeparated: 1, quantityChecked: 1, status: "CONFERIDO" }], [{ kind: "CAIXA_ABERTA" }, { kind: "CAIXA_FECHADA" }]);
    expect(result).toMatchObject({ hasPhoto: true, canFinalizeWithoutConfirmation: true, finalStatus: "PRONTO", pendingItems: [] });
  });

  it("exige confirmação para finalizar quando existe divergência", () => {
    const result = evaluateFinalization([{ quantity: 5, quantitySeparated: 4, quantityChecked: 4, status: "DIVERGENCIA" }], [{ kind: "CAIXA_ABERTA" }, { kind: "CAIXA_FECHADA" }]);
    expect(result.canFinalizeWithoutConfirmation).toBe(false);
    expect(result.finalStatus).toBe("COM_DIVERGENCIA");
    expect(result.pendingItems).toHaveLength(1);
  });

  it("identifica que não é possível finalizar sem a evidência fotográfica", () => {
    const result = evaluateFinalization([{ quantity: 1, quantitySeparated: 1, quantityChecked: 1, status: "CONFERIDO" }], []);
    expect(result.hasPhoto).toBe(false);
    expect(result.canFinalizeWithoutConfirmation).toBe(false);
  });
});
