export type OperationState = { status: string; finalizedAt?: Date | string | null };

export function isFinalized(order: OperationState) {
  return Boolean(order.finalizedAt) || order.status === "PRONTO";
}

export function canEditOrder(order: OperationState) {
  return !isFinalized(order) && ["NOVO", "AGUARDANDO_SEPARACAO"].includes(order.status);
}

export function assertOpenOrder(order: OperationState) {
  if (isFinalized(order)) throw new Error("Pedido finalizado. Os itens e as evidências estão bloqueados.");
}

export function assertEditableOrder(order: OperationState) {
  if (!canEditOrder(order)) throw new Error("A separação já começou. Os dados do pedido não podem mais ser substituídos.");
}

export function assertItemTransition(previous: { status: string; quantitySeparated: number; quantityChecked: number }, next: { status: string; quantitySeparated: number; quantityChecked: number }) {
  if (previous.status === "CONFERIDO") throw new Error("Item conferido. Não é possível alterar ou desmarcar.");
  if (previous.status === "SEPARADO" && (next.quantitySeparated !== previous.quantitySeparated || !["SEPARADO", "CONFERIDO", "DIVERGENCIA"].includes(next.status))) {
    throw new Error("Item separado. Preserve a quantidade separada e prossiga com a conferência.");
  }
}
