export function workspaceOwner(user: { id: number; role: string; workspaceOwnerId?: number | null }) {
  return user.workspaceOwnerId ?? user.id;
}

export function hasOperationAccess(user: { role: string; workspaceOwnerId?: number | null; disabledAt?: Date | string | null }) {
  return !user.disabledAt && (user.role === "admin" || (user.role === "separador" && Boolean(user.workspaceOwnerId)));
}
