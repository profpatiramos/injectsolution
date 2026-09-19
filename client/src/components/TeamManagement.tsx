import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function TeamManagement({ onChange }: { onChange: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "separador">("separador");
  const members = trpc.admin.members.useQuery(undefined, { enabled: user?.role === "admin" });
  const refresh = () => { void members.refetch(); onChange(); };
  const add = trpc.admin.addMember.useMutation({ onSuccess: () => { setName(""); setEmail(""); setRole("separador"); refresh(); toast.success("Usuário cadastrado. Ele deve entrar com o e-mail informado."); }, onError: error => toast.error(error.message) });
  const changeRole = trpc.admin.setMemberRole.useMutation({ onSuccess: () => { refresh(); toast.success("Perfil atualizado."); }, onError: error => toast.error(error.message) });
  const remove = trpc.admin.removeMember.useMutation({ onSuccess: () => { refresh(); toast.success("Usuário removido da equipe. Histórico preservado."); }, onError: error => toast.error(error.message) });
  const busy = add.isPending || changeRole.isPending || remove.isPending;
  return <section className="surface-card overflow-hidden">
    <div className="border-b p-5"><h2 className="font-display text-2xl font-bold uppercase">Administradores e funcionários</h2><p className="mt-2 text-sm text-[#65656d]">Cadastre a pessoa e escolha seu acesso. Administradores gerenciam a equipe e a operação; funcionários fazem a separação, conferência e fotos.</p></div>
    <form onSubmit={event => { event.preventDefault(); if (!busy) add.mutate({ name, email, role }); }} className="grid gap-4 border-b p-5 sm:grid-cols-2">
      <label className="text-sm font-bold">Nome<input className="field mt-2" required minLength={2} maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="text-sm font-bold">E-mail de acesso<input className="field mt-2" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="text-sm font-bold">Perfil<select className="field mt-2" value={role} onChange={event => setRole(event.target.value as "admin" | "separador")}><option value="separador">Funcionário / separador</option><option value="admin">Administrador</option></select></label>
      <button className="inject-button min-h-12 self-end px-4 text-sm" type="submit" disabled={busy}>{add.isPending ? "Cadastrando…" : "Cadastrar usuário"}</button>
      <p className="text-xs text-[#65656d] sm:col-span-2">O cadastro pode ser feito antes do primeiro acesso. Depois, a pessoa entra pelo login do sistema usando este mesmo e-mail. Não há envio automático de e-mail.</p>
    </form>
    {members.isLoading ? <p className="p-5">Carregando equipe…</p> : members.error ? <p className="p-5 text-red-700" role="alert">{members.error.message}</p> : <div className="divide-y">{members.data?.map(member => {
      const primary = member.id === (user?.workspaceOwnerId ?? user?.id);
      const protectedMember = primary || member.id === user?.id;
      return <article key={member.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-sm font-bold">{member.name || "Usuário"}{primary ? " · Administrador principal" : member.id === user?.id ? " · Você" : ""}</p><p className="mt-1 text-xs text-[#65656d]">{member.email}</p>{member.openId.startsWith("pending:") && <p className="mt-1 text-xs text-[#e31937]">Aguardando primeiro acesso</p>}</div>
        <div className="flex flex-wrap gap-2"><select aria-label={`Perfil de ${member.name || member.email}`} className="field min-h-11 sm:w-52" disabled={protectedMember || busy} value={member.role} onChange={event => changeRole.mutate({ userId: member.id, role: event.target.value as "user" | "admin" | "separador" })}><option value="user">Acesso suspenso</option><option value="separador">Funcionário / separador</option><option value="admin">Administrador</option></select>{!protectedMember && <button type="button" className="inject-outline-button min-h-11 px-3 text-xs text-[#e31937]" disabled={busy} onClick={() => { if (window.confirm(`Excluir ${member.name || member.email} da equipe? O acesso será bloqueado e o histórico de pedidos e fotos será preservado.`)) remove.mutate({ userId: member.id }); }}>Excluir usuário</button>}</div>
      </article>;
    })}</div>}
  </section>;
}
