import TeamManagement from "@/components/TeamManagement";
import { formatOperationTime, evidenceLabels } from "@shared/evidence";
import { activityLabels } from "@shared/activity";
import { Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Check, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

const roleLabels = { user: "Sem perfil", admin: "Administrador", separador: "Separador" } as const;

export default function AdminPage() {
  const { user } = useAuth();
  const activity = trpc.admin.activity.useQuery(undefined, { enabled: user?.role === "admin", refetchInterval: 30000 });
  const bling = trpc.bling.status.useQuery(undefined, { enabled: user?.role === "admin" });
  const utils = trpc.useUtils();
  const connect = trpc.bling.connect.useMutation({
    onSuccess: result => { window.location.assign(result.authorizationUrl); },
    onError: error => toast.error(error.message),
  });
  const sync = trpc.bling.sync.useMutation({
    onSuccess: result => { toast.success(`${result.imported} pedido(s) importado(s).`); bling.refetch(); utils.orders.list.invalidate(); utils.dashboard.overview.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const disconnect = trpc.bling.disconnect.useMutation({ onSuccess: () => { toast.success("Conta Bling desconectada."); bling.refetch(); }, onError: error => toast.error(error.message) });

  if (user?.role !== "admin") {
    return <div className="mx-auto max-w-3xl enter-up"><p className="section-kicker">Acesso restrito</p><h1 className="page-title mt-2">Área do administrador</h1><p className="mt-3 text-sm text-[#65656d]">Seu perfil pode operar pedidos atribuídos à equipe, mas não pode alterar usuários ou integrações.</p></div>;
  }

  return <div className="mx-auto max-w-6xl enter-up space-y-6">
    <div><p className="section-kicker">Administração</p><h1 className="page-title mt-2">Equipe e integrações</h1><p className="mt-2 text-sm text-[#65656d]">Defina quem administra o sistema e quem executa a separação no celular.</p></div>
    <section className="surface-card overflow-hidden"><div className="flex items-center justify-between gap-3 border-b p-5"><div><h2 className="font-display text-2xl font-bold uppercase">Horários e atividades</h2><p className="mt-1 text-xs text-[#77777f]">Últimos 100 registros da equipe. Atualização a cada 30 segundos.</p></div><button type="button" className="inject-outline-button min-h-11 px-3 text-xs" onClick={() => activity.refetch()}>Atualizar</button></div>{activity.isLoading ? <p className="p-5">Carregando atividades…</p> : activity.error ? <p role="alert" className="p-5 text-red-700">{activity.error.message}</p> : !activity.data?.length ? <p className="p-5 text-sm text-[#77777f]">Nenhuma atividade registrada.</p> : <div className="divide-y">{activity.data.map(event => { const kind = event.details && typeof event.details === "object" && "kind" in event.details ? String(event.details.kind) : ""; return <article key={event.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:justify-between"><div><p className="text-sm font-bold">{activityLabels[event.action] || event.action.replaceAll("_", " ")}{kind && evidenceLabels[kind] ? " · " + evidenceLabels[kind] : ""}</p><p className="mt-1 text-xs text-[#65656d]">{event.actorName || "Usuário #" + event.actorUserId}</p>{event.orderNumber && <Link className="mt-1 inline-block text-xs font-bold text-[#e31937]" href={"/orders/" + event.orderId}>Pedido #{event.orderNumber}</Link>}</div><time className="text-xs text-[#65656d]" dateTime={new Date(event.createdAt).toISOString()}>{formatOperationTime(event.createdAt)}</time></article>; })}</div>}</section>
    <TeamManagement onChange={() => { void activity.refetch(); }} />
    <section className="surface-card overflow-hidden">
      <div className="border-b border-[#e5e5e8] p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center bg-[#fff0f2] text-[#e31937]"><ShieldCheck size={19} /></span><div><h2 className="font-display text-2xl font-bold uppercase">Importação do Bling</h2><p className="text-xs text-[#77777f]">Pedidos comerciais entram como listas operacionais, sem valores.</p></div></div></div>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-bold text-[#26262b]">Status: <span className={bling.data?.status === "CONECTADO" ? "text-emerald-600" : "text-[#e31937]"}>{bling.data?.status === "CONECTADO" ? "Conectado" : bling.data?.status || "Pendente"}</span></p><p className="mt-2 text-xs leading-5 text-[#77777f]">{bling.data?.lastSyncedAt ? `Última sincronização: ${new Date(bling.data.lastSyncedAt).toLocaleString("pt-BR")}.` : "Ainda não houve sincronização."} A importação é idempotente pelo ID/número do pedido.</p></div><div className="flex flex-col gap-2 sm:flex-row"><button onClick={() => connect.mutate()} disabled={connect.isPending} className="inject-button flex min-h-11 items-center justify-center gap-2 px-4 text-sm">{connect.isPending ? <Loader2 className="animate-spin" size={16} /> : <ArrowUpRight size={16} />}Conectar conta</button><button onClick={() => sync.mutate({ sinceDays: 30 })} disabled={sync.isPending || bling.data?.status !== "CONECTADO"} className="flex min-h-11 items-center justify-center gap-2 border border-[#dedee2] px-4 text-sm font-extrabold text-[#26262b] disabled:cursor-not-allowed disabled:opacity-40">{sync.isPending ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}Sincronizar 30 dias</button></div></div>
      {bling.data?.status === "CONECTADO" && <div className="flex items-center justify-between border-t border-[#ececef] bg-[#fafafa] px-5 py-3"><p className="text-xs text-[#77777f]"><Check className="mr-1 inline text-emerald-600" size={14} />Conexão pronta para importar pedidos.</p><button onClick={() => disconnect.mutate()} className="text-xs font-extrabold uppercase tracking-wide text-[#e31937]">Desconectar</button></div>}
    </section>
  </div>;
}
