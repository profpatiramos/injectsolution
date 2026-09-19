const statusStyles: Record<string, { label: string; color: string; className: string }> = {
  NOVO: { label: "Novo", color: "#77777f", className: "border-[#d8d8dc] bg-[#f2f2f3] text-[#48484e]" },
  AGUARDANDO_SEPARACAO: { label: "Aguardando", color: "#d97706", className: "border-[#f2d49d] bg-[#fff7e8] text-[#9a5a00]" },
  EM_SEPARACAO: { label: "Em separação", color: "#e31937", className: "border-[#f3b5c0] bg-[#fff0f2] text-[#b7112a]" },
  SEPARADO: { label: "Separado", color: "#2563eb", className: "border-[#b9d1fb] bg-[#eff6ff] text-[#1d4ed8]" },
  CONFERIDO: { label: "Conferido", color: "#059669", className: "border-[#a8e5ce] bg-[#ecfdf5] text-[#047857]" },
  COM_DIVERGENCIA: { label: "Com divergência", color: "#e31937", className: "border-[#f3b5c0] bg-[#fff0f2] text-[#b7112a]" },
  PRONTO: { label: "Pronto", color: "#059669", className: "border-[#a8e5ce] bg-[#ecfdf5] text-[#047857]" },
  PENDENTE: { label: "Pendente", color: "#77777f", className: "border-[#d8d8dc] bg-[#f2f2f3] text-[#48484e]" },
  DIVERGENCIA: { label: "Divergência", color: "#e31937", className: "border-[#f3b5c0] bg-[#fff0f2] text-[#b7112a]" },
  NAO_ENCONTRADO: { label: "Não encontrado", color: "#b7112a", className: "border-[#f3b5c0] bg-[#fff0f2] text-[#b7112a]" },
};

export function StatusBadge({ status }: { status: string }) {
  const spec = statusStyles[status] ?? statusStyles.PENDENTE;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[.055em] ${spec.className}`}>
      <span className="status-dot" style={{ background: spec.color }} />
      {spec.label}
    </span>
  );
}

export function statusLabel(status: string) {
  return (statusStyles[status] ?? statusStyles.PENDENTE).label;
}
