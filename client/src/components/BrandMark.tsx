import { Link } from "wouter";

export function BrandMark({ compact = false, light = true }: { compact?: boolean; light?: boolean }) {
  const textClass = light ? "text-white" : "text-[#141416]";
  return (
    <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-none" aria-label="Página inicial da InjectSolution">
      <span className="grid h-8 w-8 shrink-0 place-items-center bg-[#e31937] text-sm font-black text-white" style={{ clipPath: "polygon(22% 0, 100% 0, 78% 100%, 0 100%)" }}>
        IS
      </span>
      {!compact && (
        <span className={`font-display text-xl font-bold uppercase italic tracking-[-0.04em] ${textClass}`}>
          Inject<span className="text-[#e31937]">Solution</span>
        </span>
      )}
    </Link>
  );
}
