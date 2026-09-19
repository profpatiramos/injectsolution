import { evidenceStatus } from "../../shared/evidence";
import type { ItemStatus, OrderStatus } from "../../drizzle/schema";

export function deriveItemStatus(input: { quantity: number; quantitySeparated: number; quantityChecked: number; status: ItemStatus }): ItemStatus {
  if (input.status === "NAO_ENCONTRADO") return "NAO_ENCONTRADO";
  if (input.status === "PENDENTE" && input.quantitySeparated === 0 && input.quantityChecked === 0) return "PENDENTE";
  if (input.status === "SEPARADO" && input.quantitySeparated === input.quantity && input.quantityChecked === 0) return "SEPARADO";
  if (input.quantitySeparated !== input.quantity || input.quantityChecked !== input.quantity) return "DIVERGENCIA";
  if (input.status === "DIVERGENCIA") return "DIVERGENCIA";
  return input.quantityChecked >= input.quantity ? "CONFERIDO" : "PENDENTE";
}

export function evaluateFinalization(items: Array<{ quantity: number; quantitySeparated: number; quantityChecked: number; status: ItemStatus }>, photos: Array<{ kind: string }>) {
  const pendingItems = items.filter(item => item.status !== "CONFERIDO" || item.quantitySeparated !== item.quantity || item.quantityChecked !== item.quantity);
  const hasPhoto = evidenceStatus(photos).complete;
  const canFinalizeWithoutConfirmation = hasPhoto && items.length > 0 && pendingItems.length === 0;
  const hasDivergence = pendingItems.some(item => item.status === "DIVERGENCIA" || item.status === "NAO_ENCONTRADO" || item.quantitySeparated !== item.quantity);
  const finalStatus: OrderStatus = canFinalizeWithoutConfirmation ? "PRONTO" : hasDivergence ? "COM_DIVERGENCIA" : "CONFERIDO";
  return { hasPhoto, canFinalizeWithoutConfirmation, finalStatus, pendingItems };
}
