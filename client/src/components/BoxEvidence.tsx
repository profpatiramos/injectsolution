import { preparePhoto } from "@/lib/preparePhoto";
import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { evidenceKinds, evidenceLabels, formatOperationTime, type EvidenceKind } from "@shared/evidence";

type Photo = { id: number; kind: string; url: string; filename: string; capturedAt: Date | string; uploadedByUserId: number; uploadedByName: string | null };

export default function BoxEvidence({ orderId, photos, locked, onChange, onBusy }: { orderId: number; photos: Photo[]; locked: boolean; onChange: () => void; onBusy: (busy: boolean) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const selection = useRef<EvidenceKind>("CAIXA_ABERTA");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Photo | null>(null);
  const upload = trpc.photos.upload.useMutation();
  const remove = trpc.photos.remove.useMutation();
  const setWorking = (value: boolean) => { setBusy(value); onBusy(value); };
  const select = (kind: EvidenceKind, source: "camera" | "gallery") => {
    selection.current = kind;
    (source === "camera" ? camera : gallery).current?.click();
  };
  const send = async (file?: File) => {
    if (!file || busy || locked) return;
    const kind = selection.current;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    setWorking(true);
    try {
      const prepared = await preparePhoto(file);
      await upload.mutateAsync({ orderId, kind, ...prepared });
      toast.success("Foto enviada. Responsável e horário registrados.");
      onChange();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto. Tente novamente."); }
    finally { setWorking(false); }
  };
  const removeImage = async (photo: Photo) => {
    if (locked || busy || !window.confirm("Remover esta foto? A remoção ficará no histórico do pedido.")) return;
    setWorking(true);
    try { await remove.mutateAsync({ photoId: photo.id }); toast.success("Foto removida."); onChange(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover a foto."); }
    finally { setWorking(false); }
  };
  const photoCard = (photo: Photo) => <figure key={photo.id} className="overflow-hidden border border-[#dedee2] bg-white">
    <button type="button" onClick={() => setPreview(photo)} className="relative block w-full" aria-label={`Ampliar ${evidenceLabels[photo.kind] || "foto"}`}><img src={photo.url} alt={evidenceLabels[photo.kind] || "Foto da caixa"} className="aspect-[4/3] w-full object-cover" /><Maximize2 size={18} className="absolute right-2 top-2 bg-white text-black" /></button>
    <figcaption className="space-y-1 p-3"><p className="text-xs font-bold">Enviada por {photo.uploadedByName || `Usuário #${photo.uploadedByUserId}`}</p><p className="text-xs text-[#65656d]">Recebida em {formatOperationTime(photo.capturedAt)}</p>{!locked && <button type="button" disabled={busy} onClick={() => removeImage(photo)} className="mt-2 min-h-10 text-xs font-bold text-[#e31937]">Remover foto</button>}</figcaption>
  </figure>;
  return <div className="surface-card p-5 sm:p-7">
    <p className="section-kicker">Comprovação da embalagem</p><h2 className="font-display mt-2 text-2xl font-bold uppercase">Duas fotos obrigatórias</h2><p className="mt-2 text-sm text-[#65656d]">Registre os produtos antes de fechar a caixa e a etiqueta de endereço depois de fechá-la. O horário registrado é o recebimento no sistema.</p>
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden disabled={locked || busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void send(file); }} />
    <input ref={gallery} type="file" accept="image/*" hidden disabled={locked || busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void send(file); }} />
    <div className="mt-6 grid gap-6 md:grid-cols-2">{evidenceKinds.map((kind, index) => {
      const stagePhotos = photos.filter(photo => photo.kind === kind);
      return <section key={kind} className="min-w-0 border border-[#e5e5e8] p-4"><p className="section-kicker">Etapa {index + 1} · {stagePhotos.length ? "Registrada" : "Pendente"}</p><h3 className="mt-2 text-sm font-extrabold">{evidenceLabels[kind]}</h3><p className="mt-2 text-xs text-[#65656d]">{kind === "CAIXA_ABERTA" ? "Mostre todos os produtos acomodados dentro da caixa aberta." : "Mostre a caixa fechada e o endereço do cliente legível na etiqueta."}</p>
        {!locked && <div className="my-4 flex flex-wrap gap-2"><button type="button" onClick={() => select(kind, "camera")} disabled={busy} className="inject-button flex min-h-11 items-center gap-2 px-3 text-xs"><Camera size={16} />Tirar foto</button><button type="button" onClick={() => select(kind, "gallery")} disabled={busy} className="inject-outline-button flex min-h-11 items-center gap-2 px-3 text-xs"><ImagePlus size={16} />Enviar foto</button></div>}
        <div className="mt-4 space-y-3">{stagePhotos.map(photoCard)}{!stagePhotos.length && <p className="border border-dashed p-5 text-center text-xs text-[#77777f]">Nenhuma foto desta etapa.</p>}</div>
      </section>;
    })}</div>
    {busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />Processando foto. Aguarde a confirmação.</p>}
    {photos.some(photo => photo.kind === "LEGADO") && <section className="mt-6"><h3 className="text-sm font-bold">Fotos anteriores sem classificação</h3><p className="mt-1 text-xs text-[#65656d]">Preservadas no histórico. Não substituem as duas etapas obrigatórias.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{photos.filter(photo => photo.kind === "LEGADO").map(photoCard)}</div></section>}
    {preview && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-5" role="dialog" aria-modal="true" aria-label="Foto da embalagem"><button type="button" autoFocus onClick={() => setPreview(null)} className="absolute right-5 top-5 min-h-11 bg-white px-3" aria-label="Fechar foto"><X /></button><figure><img src={preview.url} alt={evidenceLabels[preview.kind]} className="max-h-[75vh] max-w-full object-contain" /><figcaption className="mt-3 text-center text-sm text-white">{preview.uploadedByName || `Usuário #${preview.uploadedByUserId}`} · {formatOperationTime(preview.capturedAt)}</figcaption></figure></div>}
  </div>;
}
