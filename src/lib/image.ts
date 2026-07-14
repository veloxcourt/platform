export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  mimeType?: "image/jpeg" | "image/webp";
  initialQuality?: number;
};

export const AVATAR_IMAGE_OPTIONS: CompressImageOptions = {
  maxWidth: 384,
  maxHeight: 384,
  maxBytes: 250_000,
  mimeType: "image/jpeg",
  initialQuality: 0.78,
};

export const PRODUCT_IMAGE_OPTIONS: CompressImageOptions = {
  maxWidth: 1024,
  maxHeight: 1024,
  maxBytes: 1_000_000,
  mimeType: "image/jpeg",
  initialQuality: 0.85,
};

const DEFAULT_OPTIONS: Required<CompressImageOptions> = {
  maxWidth: 384,
  maxHeight: 384,
  maxBytes: 250_000,
  mimeType: "image/jpeg",
  initialQuality: 0.78,
};

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup?: () => void;
};

export type AvatarCropParams = {
  offsetX: number;
  offsetY: number;
  zoom: number;
  viewportPx: number;
  fitMode?: "cover" | "contain";
};

export async function getImageSize(
  file: File,
): Promise<{ width: number; height: number }> {
  const loaded = await loadImage(file);
  try {
    return { width: loaded.width, height: loaded.height };
  } finally {
    loaded.cleanup?.();
  }
}

/// Recorta un cuadrado (avatar) según pan/zoom y lo comprime.
export async function exportAvatarCrop(
  file: File,
  crop: AvatarCropParams,
  options: CompressImageOptions = AVATAR_IMAGE_OPTIONS,
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const outputPx = opts.maxWidth;
  const loaded = await loadImage(file);

  try {
    if (crop.fitMode === "contain") {
      let quality = opts.initialQuality;
      let blob: Blob | null = null;
      let targetPx = outputPx;

      while (targetPx >= 128) {
        const canvas = document.createElement("canvas");
        canvas.width = targetPx;
        canvas.height = targetPx;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas context");

        const scale = Math.min(
          targetPx / loaded.width,
          targetPx / loaded.height,
        );
        const drawW = loaded.width * scale;
        const drawH = loaded.height * scale;
        const drawX = (targetPx - drawW) / 2;
        const drawY = (targetPx - drawH) / 2;

        ctx.fillStyle = "#f4f4f5";
        ctx.fillRect(0, 0, targetPx, targetPx);
        ctx.drawImage(
          loaded.source,
          0,
          0,
          loaded.width,
          loaded.height,
          drawX,
          drawY,
          drawW,
          drawH,
        );

        quality = opts.initialQuality;
        blob = await canvasToBlob(canvas, opts.mimeType, quality);
        while (blob.size > opts.maxBytes && quality > 0.4) {
          quality -= 0.08;
          blob = await canvasToBlob(canvas, opts.mimeType, quality);
        }
        if (blob.size <= opts.maxBytes) break;
        targetPx = Math.max(128, Math.round(targetPx * 0.85));
      }

      if (!blob) throw new Error("no blob");

      const ext = opts.mimeType === "image/webp" ? "webp" : "jpg";
      const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
      return new File([blob], `${baseName}.${ext}`, {
        type: opts.mimeType,
        lastModified: Date.now(),
      });
    }

    const baseScale = Math.max(
      crop.viewportPx / loaded.width,
      crop.viewportPx / loaded.height,
    );
    const scale = baseScale * crop.zoom;
    const srcX = -crop.offsetX / scale;
    const srcY = -crop.offsetY / scale;
    const srcSize = crop.viewportPx / scale;

    let quality = opts.initialQuality;
    let blob: Blob | null = null;
    let targetPx = outputPx;

    while (targetPx >= 128) {
      const canvas = document.createElement("canvas");
      canvas.width = targetPx;
      canvas.height = targetPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");

      ctx.drawImage(
        loaded.source,
        srcX,
        srcY,
        srcSize,
        srcSize,
        0,
        0,
        targetPx,
        targetPx,
      );

      quality = opts.initialQuality;
      blob = await canvasToBlob(canvas, opts.mimeType, quality);
      while (blob.size > opts.maxBytes && quality > 0.4) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, opts.mimeType, quality);
      }
      if (blob.size <= opts.maxBytes) break;
      targetPx = Math.max(128, Math.round(targetPx * 0.85));
    }

    if (!blob) throw new Error("no blob");

    const ext = opts.mimeType === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.${ext}`, {
      type: opts.mimeType,
      lastModified: Date.now(),
    });
  } finally {
    loaded.cleanup?.();
  }
}

/// Redimensiona y comprime una imagen (útil para fotos de cámara en el celular).
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const loaded = await loadImage(file);

  try {
    let targetW = loaded.width;
    let targetH = loaded.height;
    ({ width: targetW, height: targetH } = fitInside(
      targetW,
      targetH,
      opts.maxWidth,
      opts.maxHeight,
    ));

    let quality = opts.initialQuality;
    let blob: Blob | null = null;

    // Si aún pesa mucho, baja calidad y/o tamaño hasta el límite.
    while (targetW >= 128 && targetH >= 128) {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");

      ctx.drawImage(loaded.source, 0, 0, targetW, targetH);

      quality = opts.initialQuality;
      blob = await canvasToBlob(canvas, opts.mimeType, quality);
      while (blob.size > opts.maxBytes && quality > 0.4) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, opts.mimeType, quality);
      }
      if (blob.size <= opts.maxBytes) break;

      targetW = Math.max(128, Math.round(targetW * 0.85));
      targetH = Math.max(128, Math.round(targetH * 0.85));
    }

    if (!blob) throw new Error("no blob");

    const ext = opts.mimeType === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.${ext}`, {
      type: opts.mimeType,
      lastModified: Date.now(),
    });
  } finally {
    loaded.cleanup?.();
  }
}

/// Convierte cualquier imagen (blob) a PNG (formato aceptado por el portapapeles).
export function blobToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("no ctx"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(url);
        b ? resolve(b) : reject(new Error("no blob"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("img load"));
    };
    img.src = url;
  });
}

function fitInside(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback para navegadores sin imageOrientation.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("img load"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("no blob"))),
      type,
      quality,
    );
  });
}
