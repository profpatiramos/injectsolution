// Keep the JSON upload below the Vercel function payload limit.
export async function preparePhoto(file: File): Promise<{ base64: string; mimeType: string; filename: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma foto.");
  if (file.size > 20 * 1024 * 1024) throw new Error("A foto deve ter até 20 MB antes da preparação.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2400 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto neste navegador.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.84, 0.75, 0.65]) {
      const base64 = canvas.toDataURL("image/jpeg", quality);
      if (base64.length < 4 * 1024 * 1024) return { base64, mimeType: "image/jpeg", filename: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
    }
    throw new Error("A foto ficou muito grande. Tente uma imagem de menor resolução mantendo o endereço legível.");
  } catch (error) {
    if (error instanceof DOMException) throw new Error("Não foi possível abrir essa imagem. Use uma foto JPG, PNG ou WebP.");
    throw error;
  } finally { URL.revokeObjectURL(url); }
}
