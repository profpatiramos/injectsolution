import { StatusBadge } from "@/components/StatusBadge";
import { trpc } from "@/lib/trpc";
import { ArrowRight, ClipboardList, Loader2, PackagePlus, TriangleAlert } from "lucide-react";
import { Link } from "wouter";

const metrics = [
  { key: "NOVO", label: "Pedidos novos" },
  { key: "AGUARDANDO_SEPARACAO", label: "Aguardando" },
  { key: "EM_SEPARACAO", label: "Em separação" },
  { key: "COM_DIVERGENCIA", label: "Divergências" },
  { key: "PRONTO", label: "Prontos" },
] as const;

function vehicle(order: { vehicleBrand: string | null; vehicleModel: string | null; vehicleEngine: string | null }) { return [order.vehicleBrand, order.vehicleModel].filter(Boolean).join(" ") || order.vehicleEngine || "Veículo não informado"; }

export default function DashboardPage() {
  const overview = trpc.dashboard.overview.useQuery();
  if (overview.isLoading) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="animate-spin text-[#e31937]" /></div>;
  if (overview.error) return <div className="surface-card max-w-xl p-7"><TriangleAlert className="text-[#e31937]" /><h1 className="page-title mt-4">Não foi possível carregar</h1><p className="mt-2 text-sm text-[#65656d]">{overview.error.message}</p></div>;
  const data = overview.data!;
  return <div className="mx-auto max-w-7xl enter-up"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="section-kicker">Visão geral</p><h1 className="page-title mt-2">Central de operação</h1><p className="mt-2 text-sm text-[#65656d]">Acompanhe a separação dos seus pedidos em tempo real.</p></div><Link href="/orders/new" className="inject-button flex min-h-12 items-center justify-center gap-2 px-5 text-sm"><PackagePlus size={18} />Novo pedido</Link></div>
    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(metric => <div key={metric.key} className="surface-card metric-card p-5"><p className="text-[.67rem] font-extrabold uppercase tracking-[.1em] text-[#77777f]">{metric.label}</p><p className="font-display mt-6 text-5xl font-bold leading-none text-[#171719]">{data.counts[metric.key]}</p></div>)}</section>
    <section className="mt-8 grid gap-6 xl:grid-cols-[1.45fr_.75fr]"><div className="surface-card overflow-hidden"><div className="flex items-center justify-between border-b border-[#e4e4e7] p-5"><div><p className="font-display text-xl font-bold uppercase">Pedidos recentes</p><p className="mt-1 text-xs text-[#77777f]">Últimas atividades registradas</p></div><Link href="/orders" className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-[#e31937]">Ver todos <ArrowRight size={15} /></Link></div>{data.recent.length === 0 ? <div className="grid min-h-55 place-items-center p-8 text-center"><ClipboardList className="text-[#cfcfd4]" size={32} /><p className="mt-3 text-sm font-bold">Nenhum pedido cadastrado.</p><Link href="/orders/new" className="mt-4 text-sm font-extrabold text-[#e31937]">Cadastrar primeiro pedido</Link></div> : <div className="divide-y divide-[#ebebed]">{data.recent.map(order => <Link key={order.id} href={`/orders/${order.id}`} className="flex flex-col gap-3 p-5 transition-colors hover:bg-[#fafafa] sm:flex-row sm:items-center sm:justify-between"><div><p className="font-display text-xl font-bold uppercase">#{order.blingOrderNumber}</p><p className="mt-1 text-sm font-bold text-[#29292e]">{order.customerName}</p><p className="mt-1 text-xs text-[#77777f]">{vehicle(order)}</p></div><StatusBadge status={order.status} /></Link>)}</div>}</div>
      <aside className="bg-[#171719] p-6 text-white"><p className="section-kicker">Atenção operacional</p><h2 className="font-display mt-3 text-3xl font-bold uppercase leading-none">Pendências para<br />acompanhar.</h2><p className="mt-4 text-sm leading-6 text-zinc-400">Pedidos que ainda não estão prontos para liberação.</p><div className="mt-7 divide-y divide-white/10">{data.pending.slice(0, 4).map(order => <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between gap-3 py-4"><div><p className="font-display text-lg font-bold uppercase">#{order.blingOrderNumber}</p><p className="text-xs text-zinc-500">{order.customerName}</p></div><ArrowRight size={16} className="text-[#e31937]" /></Link>)}{data.pending.length === 0 && <p className="py-7 text-sm text-zinc-500">Nenhuma pendência registrada.</p>}</div></aside>
    </section></div>;
}
