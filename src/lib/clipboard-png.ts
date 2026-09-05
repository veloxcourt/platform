/// Copia la imagen PNG al portapapeles para pegarla en WhatsApp (Ctrl+V).
export async function copyPngToClipboard(blob: Blob, filename: string) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Este navegador no permite copiar la imagen al portapapeles.");
  }
  const file = new File([blob], filename, { type: "image/png" });
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": file }),
  ]);
}

export function openPngBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}

export function downloadPngBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}
