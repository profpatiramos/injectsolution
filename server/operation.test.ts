import { describe, expect, it } from "vitest";
import { assertItemTransition, assertOpenOrder, canEditOrder } from "../shared/operation";
import { hasOperationAccess, workspaceOwner } from "../shared/access";
import { deriveItemStatus, evaluateFinalization } from "./domain/separation";

describe("fluxo operacional", () => {
  it.each(["PRONTO", "CONFERIDO", "COM_DIVERGENCIA"])("bloqueia pedido finalizado com status %s", status => {
    expect(() => assertOpenOrder({ status, finalizedAt: new Date() })).toThrow("finalizado");
  });
  it("preserva conferência durante edição ou importação", () => {
    expect(canEditOrder({ status: "EM_SEPARACAO" })).toBe(false);
    expect(canEditOrder({ status: "NOVO" })).toBe(true);
  });
  it("não permite desfazer item conferido", () => {
    expect(() => assertItemTransition({ status: "CONFERIDO", quantitySeparated: 2, quantityChecked: 2 }, { status: "PENDENTE", quantitySeparated: 0, quantityChecked: 0 })).toThrow("conferido");
  });
  it("permite conferir sem mudar a quantidade já separada", () => {
    const separated = { status: "SEPARADO", quantitySeparated: 2, quantityChecked: 0 };
    expect(() => assertItemTransition(separated, { status: "CONFERIDO", quantitySeparated: 2, quantityChecked: 2 })).not.toThrow();
    expect(() => assertItemTransition(separated, { status: "CONFERIDO", quantitySeparated: 3, quantityChecked: 3 })).toThrow("separado");
  });
  it("separar não equivale a conferir", () => {
    expect(deriveItemStatus({ quantity: 2, quantitySeparated: 2, quantityChecked: 0, status: "SEPARADO" })).toBe("SEPARADO");
    expect(evaluateFinalization([{ quantity: 2, quantitySeparated: 2, quantityChecked: 0, status: "SEPARADO" }], [{ kind: "CAIXA_ABERTA" }, { kind: "CAIXA_FECHADA" }]).canFinalizeWithoutConfirmation).toBe(false);
    expect(evaluateFinalization([], [{ kind: "CAIXA_ABERTA" }, { kind: "CAIXA_FECHADA" }]).canFinalizeWithoutConfirmation).toBe(false);
  });
  it("administrador promovido permanece na equipe", () => {
    expect(workspaceOwner({ id: 2, role: "admin", workspaceOwnerId: 1 })).toBe(1);
    expect(hasOperationAccess({ role: "user", workspaceOwnerId: 1 })).toBe(false);
    expect(hasOperationAccess({ role: "separador" })).toBe(false);
  });
});
