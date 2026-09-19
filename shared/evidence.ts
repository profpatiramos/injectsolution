export const evidenceKinds = ["CAIXA_ABERTA", "CAIXA_FECHADA"] as const;
export type EvidenceKind = (typeof evidenceKinds)[number];
export const evidenceLabels: Record<string, string> = {
  CAIXA_ABERTA: "Caixa aberta — produtos",
  CAIXA_FECHADA: "Caixa fechada — endereço do cliente",
  LEGADO: "Foto anterior — sem classificação",
};

export function evidenceStatus(photos: Array<{ kind: string }>) {
  const hasOpenBox = photos.some(photo => photo.kind === "CAIXA_ABERTA");
  const hasClosedBox = photos.some(photo => photo.kind === "CAIXA_FECHADA");
  return { hasOpenBox, hasClosedBox, complete: hasOpenBox && hasClosedBox };
}

export function formatOperationTime(date: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }).format(new Date(date));
}
