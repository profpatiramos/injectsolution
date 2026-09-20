import { hasOperationAccess } from "@shared/access";
import { useAuth } from "@/_core/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { Archive, Boxes, LayoutDashboard, LogOut, Menu, PackagePlus, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/app", adminOnly: false },
  { icon: Archive, label: "Pedidos", path: "/orders", adminOnly: false },
  { icon: PackagePlus, label: "Novo pedido", path: "/orders/new", adminOnly: true },
  { icon: Boxes, label: "Produtos", path: "/products", adminOnly: false },
  { icon: ShieldCheck, label: "Administração", path: "/admin", adminOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#09090a] text-white"><span className="h-8 w-8 animate-spin border-2 border-[#e31937] border-t-transparent" /></div>;
  if (!user) {
    return (
      <div className="brand-slash grid min-h-screen place-items-center bg-[#09090a] px-5 text-white">
        <div className="relative z-10 w-full max-w-md border border-white/15 bg-[#171719] p-8 shadow-2xl sm:p-10">
          <BrandMark />
          <p className="section-kicker mt-12">Sistema de produção</p>
          <h1 className="font-display mt-3 text-4xl font-bold uppercase leading-none">Acesse sua<br />operação.</h1>
          <p className="mt-5 text-sm leading-6 text-zinc-400">Entre para gerenciar pedidos, conferências e evidências de separação em um único lugar.</p>
          <button onClick={() => startLogin()} className="inject-button mt-8 min-h-12 w-full px-5">Entrar no sistema</button>
        </div>
      </div>
    );
  }

  if (!hasOperationAccess(user)) return <div className="surface-card m-8 p-8"><h1 className="page-title">Aguardando liberação</h1><p className="mt-4">Peça ao administrador que adicione seu e-mail à equipe e libere seu perfil.</p><button className="inject-button mt-5 p-3" onClick={() => window.location.reload()}>Verificar acesso</button><button className="ml-4" onClick={logout}>Sair</button></div>;
  const adminRoute = ["/categories", "/admin", "/orders/new"].includes(location) || /^\/orders\/[^/]+\/edit$/.test(location);
  if (adminRoute && user.role !== "admin") return <div className="surface-card m-8 p-8"><h1 className="page-title">Acesso restrito</h1><p className="mt-4">Esta área é exclusiva do administrador.</p><Link href="/orders" className="inject-button mt-5 inline-block p-3">Voltar aos pedidos</Link></div>;
  const closeMenu = () => setMenuOpen(false);
  const visibleMenuItems = menuItems.filter(item => !item.adminOnly || user.role === "admin");
  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      {menuOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={closeMenu} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-[#09090a] shadow-2xl transition-transform duration-200 lg:translate-x-0", menuOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6"><BrandMark /><button onClick={closeMenu} className="text-zinc-400 lg:hidden" aria-label="Fechar menu"><X size={20} /></button></div>
        <div className="px-4 pt-7"><p className="px-3 text-[0.64rem] font-bold uppercase tracking-[.16em] text-zinc-600">Operação</p></div>
        <nav className="mt-3 grid gap-1 px-3" aria-label="Navegação principal">
          {visibleMenuItems.map(item => {
            const active = location === item.path || (item.path === "/orders" && location.startsWith("/orders/") && !location.endsWith("/new"));
            return <Link key={item.path} href={item.path} onClick={closeMenu} className={cn("nav-item flex h-12 items-center gap-3 px-3 text-sm font-bold", active && "nav-item-active")}><item.icon size={18} strokeWidth={active ? 2.4 : 1.8} />{item.label}</Link>;
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="flex items-center gap-3 px-2 py-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e31937] text-sm font-extrabold text-white">{user.name?.charAt(0).toUpperCase() ?? "U"}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user.name || "Usuário"}</p><p className="truncate text-xs text-zinc-500">{user.email || "Acesso individual"}</p></div></div>
          <button onClick={logout} className="mt-2 flex h-10 w-full items-center gap-3 px-2 text-sm font-bold text-zinc-400 transition-colors hover:text-white"><LogOut size={17} />Sair</button>
        </div>
      </aside>
      <div className="lg:pl-[272px]">
        <header className="no-print sticky top-0 z-30 flex h-[66px] items-center justify-between border-b border-[#e2e2e5] bg-white/95 px-4 backdrop-blur lg:px-8"><div className="flex items-center gap-3"><button onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center border border-[#dedee2] text-[#242429] lg:hidden" aria-label="Abrir menu"><Menu size={20} /></button><div className="lg:hidden"><BrandMark light={false} /></div><div className="hidden lg:block"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#77777f]">InjectSolution</p><p className="text-sm font-extrabold text-[#202024]">Central de produção</p></div></div><div className="flex items-center gap-2"><span className="hidden h-2 w-2 rounded-full bg-[#e31937] sm:block" /><span className="text-[.62rem] font-bold uppercase tracking-[.08em] text-[#77777f] sm:text-xs">Operação online</span></div></header>
        <main className="min-h-[calc(100vh-66px)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
