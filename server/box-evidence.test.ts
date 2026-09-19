import { describe, expect, it } from "vitest";
import { evidenceStatus } from "../shared/evidence";
import { evaluateFinalization } from "./domain/separation";

const items = [{ quantity: 1, quantitySeparated: 1, quantityChecked: 1, status: "CONFERIDO" as const }];
describe("evidência de embalagem", () => {
  it.each([[], [{ kind: "CAIXA_ABERTA" }], [{ kind: "CAIXA_FECHADA" }], [{ kind: "CAIXA_ABERTA" }, { kind: "CAIXA_ABERTA" }], [{ kind: "LEGADO" }, { kind: "LEGADO" }]].map(photos => ({ photos })))("exige ambas as etapas: $photos", ({ photos }) => {
    expect(evidenceStatus(photos).complete).toBe(false);
    expect(evaluateFinalization(items, photos).canFinalizeWithoutConfirmation).toBe(false);
  });
  it("aceita fotos das duas etapas, incluindo fotos adicionais", () => {
    const photos = [{ kind: "CAIXA_ABERTA" }, { kind: "CAIXA_FECHADA" }, { kind: "LEGADO" }];
    expect(evaluateFinalization(items, photos)).toMatchObject({ hasPhoto: true, canFinalizeWithoutConfirmation: true, finalStatus: "PRONTO" });
  });
});
