import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { activityLabels } from "@shared/activity";
import { evidenceLabels, formatOperationTime } from "@shared/evidence";

const empty = { search: "", action: "", from: "", to: "" };
export default function ActivityPage() {
  const { user } = useAuth();
  const [draft, setDraft] = useState(empty);
  const [filters, setFilters] = useState(empty);
  const [page, setPage] = useState(0);
  const until = filters.to ? new Date(filters.to + "T00:00:00") : undefined;
  if (until) until.setDate(until.getDate() + 1);
  const activity = trpc.admin.activity.useQuery({ page, search: filters.search || undefined, action: filters.action || undefined, from: filters.from ? new Date(filters.from + "T00:00:00").toISOString() : undefined, until: until?.toISOString() }, { enabled: user?.role === "admin", refetchInterval: page === 0 ? 30000 : false });
  if (user?.role !== "admin") return <p>Apenas administradores podem consultar o histórico da equipe.</p>;
  return <div className="mx-auto max-w-7xl space-y-6">
    <header><p className="section-kicker">Acompanhamento</p><h1 className="page-title mt-2">Histórico de atividades</h1><p className="mt-3 text-sm text-[#65656d]">Veja quem realizou cada ação e em qual horário. Os registros permanecem após a exclusão de pedidos. Horários de Brasília.</p></header>
    <form className="surface-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); setPage(0); setFilters(draft); }}>
      <label className="text-sm font-bold">Funcionário ou pedido<input className="field mt-2" placeholder="Nome ou número do pedido" value={draft.search} onChange={e => setDraft({ ...draft, search: e.target.value })} /></label>
      <label className="text-sm font-bold">Atividade<select className="field mt-2" value={draft.action} onChange={e => setDraft({ ...draft, action: e.target.value })}><option value="">Todas as atividades</option>{Object.entries(activityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm font-bold">De<input className="field mt-2" type="date" value={draft.from} max={draft.to || undefined} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
      <label className="text-sm font-bold">Até<input className="field mt-2" type="date" value={draft.to} min={draft.from || undefined} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><button className="inject-button min-h-11 px-5">Filtrar</button><button type="button" className="inject-outline-button min-h-11 px-4" onClick={() => { setDraft(empty); setFilters(empty); setPage(0); }}>Limpar filtros</button><button type="button" className="inject-outline-button min-h-11 px-4" disabled={activity.isFetching} onClick={() => activity.refetch()}>Atualizar</button></div>
    </form>
    <section className="surface-card overflow-hidden"><div className="border-b p-5 text-sm text-[#65656d]">Página {page + 1} · Até 100 registros por página. A primeira página atualiza a cada 30 segundos.</div>
      {activity.isLoading ? <p className="p-5">Carregando histórico…</p> : activity.error ? <p role="alert" className="p-5 text-red-700">{activity.error.message}</p> : !activity.data?.length ? <p className="p-5">Nenhuma atividade encontrada para esses filtros.</p> : <div className="divide-y">{activity.data.map(event => {
        const details = event.details && typeof event.details === "object" ? event.details as Record<string, unknown> : {};
        const number = event.orderNumber || (typeof details.number === "string" ? details.number : "");
        const kind = typeof details.kind === "string" ? details.kind : "";
        return <article key={event.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:justify-between"><div><h2 className="text-sm font-extrabold">{activityLabels[event.action] || event.action.replaceAll("_", " ")}</h2><p className="mt-1 text-sm">{event.actorName || `Usuário #${event.actorUserId}`}</p>{number && (event.orderNumber ? <Link href={`/orders/${event.orderId}`} className="mt-1 block text-sm font-bold text-[#e31937]">Pedido #{number}</Link> : <p className="mt-1 text-sm">Pedido #{number} · Excluído</p>)}{kind in evidenceLabels && <p className="mt-1 text-xs text-[#65656d]">{evidenceLabels[kind as keyof typeof evidenceLabels]}</p>}{event.action === "PEDIDO_EXCLUIDO" && typeof details.previousStatus === "string" && <p className="mt-1 text-xs text-[#65656d]">Situação antes da exclusão: {details.previousStatus.replaceAll("_", " ")}</p>}{typeof details.note === "string" && details.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm">Observação: {details.note}</p>}</div><time className="shrink-0 text-xs text-[#65656d]" dateTime={new Date(event.createdAt).toISOString()}>{formatOperationTime(event.createdAt)}</time></article>;
      })}</div>}
    </section>
    <nav className="flex items-center justify-between gap-3" aria-label="Páginas do histórico"><button className="inject-outline-button min-h-11 px-4" disabled={page === 0 || activity.isFetching} onClick={() => setPage(page - 1)}>Mais recentes</button><button className="inject-outline-button min-h-11 px-4" disabled={activity.isFetching || (activity.data?.length ?? 0) < 100} onClick={() => setPage(page + 1)}>Mais antigos</button></nav>
  </div>;
}
