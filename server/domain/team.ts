export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export function assertManageableMember(ownerId: number, actorId: number, target: { id: number; workspaceOwnerId: number | null }) {
  if (target.id !== ownerId && target.workspaceOwnerId !== ownerId) throw new Error("Usuário não encontrado nesta equipe.");
  if (target.id === ownerId) throw new Error("O administrador principal não pode ser removido ou rebaixado.");
  if (target.id === actorId) throw new Error("Você não pode remover seu próprio acesso.");
}
