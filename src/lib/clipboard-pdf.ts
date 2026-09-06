/// Entrega el PDF como archivo. El portapapeles del navegador no puede
/// dejar un .pdf real: Chrome lo termina pegando como imagen.

export type PdfCopyResult = "shared" | "downloaded";

export async function copyPdfToClipboard(
  blob: Blob,
  filename: string,
): Promise<PdfCopyResult> {
  const pdfFile = new File([await blob.arrayBuffer()], filename, {
    type: "application/pdf",
  });

  if (navigator.canShare?.({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: filename,
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        downloadPdfFile(pdfFile);
        return "downloaded";
      }
    }
  }

  downloadPdfFile(pdfFile);
  return "downloaded";
}

function downloadPdfFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}
