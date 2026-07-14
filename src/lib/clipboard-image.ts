function fileFromBlob(blob: Blob, type: string, name = "pegado"): File {
  const ext = type.split("/")[1] || "png";
  return new File([blob], `${name}.${ext}`, { type });
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
}

function dataUrlToFile(dataUrl: string): File | null {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  const type = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return fileFromBlob(new Blob([bytes], { type }), type);
}

function imageFromHtml(html: string): File | null {
  const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (!src?.startsWith("data:image/")) return null;
  return dataUrlToFile(src);
}

async function imageFromHtmlAsync(html: string): Promise<File | null> {
  const sync = imageFromHtml(html);
  if (sync) return sync;

  const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (!src?.startsWith("http")) return null;

  try {
    const res = await fetch(src);
    const blob = await res.blob();
    if (blob.type.startsWith("image/")) {
      return fileFromBlob(blob, blob.type);
    }
  } catch {
    return null;
  }
  return null;
}

/// Extrae una imagen del evento paste (Ctrl+V / menú Pegar).
export function imageFileFromPasteEvent(e: ClipboardEvent): File | null {
  const cd = e.clipboardData;
  if (!cd) return null;

  const files = cd.files;
  if (files?.length) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isImageFile(file)) return file;
    }
  }

  const items = cd.items;
  if (items) {
    for (const item of items) {
      if (item.kind !== "file") continue;
      const blob = item.getAsFile();
      if (!blob) continue;
      const type = item.type || blob.type || "image/png";
      if (type.startsWith("image/") || isImageFile(blob)) {
        return fileFromBlob(blob, type.startsWith("image/") ? type : blob.type || "image/png");
      }
    }
  }

  const html = cd.getData("text/html");
  if (html) {
    const fromHtml = imageFromHtml(html);
    if (fromHtml) return fromHtml;
  }

  const text = cd.getData("text/plain");
  if (text.startsWith("data:image/")) {
    return dataUrlToFile(text);
  }

  return null;
}

/// Versión async: también intenta descargar imágenes http del HTML pegado.
export async function imageFileFromPasteEventAsync(
  e: ClipboardEvent,
): Promise<File | null> {
  const sync = imageFileFromPasteEvent(e);
  if (sync) return sync;

  const html = e.clipboardData?.getData("text/html");
  if (html) return imageFromHtmlAsync(html);

  return null;
}

/// Lee imagen vía Clipboard API (botón Pegar).
export async function readImageFileFromClipboard(): Promise<File | null> {
  try {
    if (!navigator.clipboard?.read) return null;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (!type.startsWith("image/")) continue;
        const blob = await item.getType(type);
        return fileFromBlob(blob, type);
      }
      if (item.types.includes("text/html")) {
        const html = await item.getType("text/html");
        const text = await html.text();
        const fromHtml = imageFromHtml(text);
        if (fromHtml) return fromHtml;
        const fromHttp = await imageFromHtmlAsync(text);
        if (fromHttp) return fromHttp;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/// Registra un listener global de paste que prioriza imágenes aunque el foco esté en un input.
export function bindImagePasteListener(
  onFile: (file: File) => void,
): () => void {
  async function onPaste(e: ClipboardEvent) {
    const file = await imageFileFromPasteEventAsync(e);
    if (!file) return;
    e.preventDefault();
    e.stopPropagation();
    onFile(file);
  }
  window.addEventListener("paste", onPaste, true);
  return () => window.removeEventListener("paste", onPaste, true);
}
