/// Copia el archivo PDF al portapapeles para pegarlo en WhatsApp (Ctrl+V).
export async function copyPdfToClipboard(blob: Blob, filename: string) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Este navegador no permite copiar el PDF al portapapeles.");
  }

  const pdfFile = new File([blob], filename, { type: "application/pdf" });

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "application/pdf": pdfFile }),
    ]);
    return;
  } catch {
    // Chrome a veces exige una Promise para tipos que no son imagen.
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "application/pdf": Promise.resolve(pdfFile),
      }),
    ]);
  } catch {
    throw new Error(
      "No se pudo copiar el PDF. Usá Crear y Abrir y adjuntá el archivo en WhatsApp.",
    );
  }
}
