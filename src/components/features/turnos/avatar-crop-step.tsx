"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AVATAR_IMAGE_OPTIONS,
  exportAvatarCrop,
  getImageSize,
  type AvatarCropParams,
  type CompressImageOptions,
} from "@/lib/image";

const VIEWPORT_PX = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type FitMode = "cover" | "contain";

function getBaseScale(width: number, height: number, mode: FitMode) {
  if (mode === "contain") {
    return Math.min(VIEWPORT_PX / width, VIEWPORT_PX / height);
  }
  return Math.max(VIEWPORT_PX / width, VIEWPORT_PX / height);
}

function getRenderedSize(
  width: number,
  height: number,
  zoom: number,
  mode: FitMode,
) {
  const base = getBaseScale(width, height, mode);
  return {
    width: width * base * zoom,
    height: height * base * zoom,
  };
}

function centerOffset(renderedW: number, renderedH: number) {
  return {
    x: (VIEWPORT_PX - renderedW) / 2,
    y: (VIEWPORT_PX - renderedH) / 2,
  };
}

function clampOffset(
  offset: { x: number; y: number },
  renderedW: number,
  renderedH: number,
) {
  return {
    x: Math.min(0, Math.max(VIEWPORT_PX - renderedW, offset.x)),
    y: Math.min(0, Math.max(VIEWPORT_PX - renderedH, offset.y)),
  };
}

export function AvatarCropStep({
  file,
  onCancel,
  onConfirm,
  compressOptions = AVATAR_IMAGE_OPTIONS,
  hint = "Arrastrá la imagen para centrar la cara dentro del círculo.",
  defaultFitFullImage = false,
  shape = "circle",
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  compressOptions?: CompressImageOptions;
  hint?: string;
  defaultFitFullImage?: boolean;
  shape?: "circle" | "square";
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [fitFullImage, setFitFullImage] = useState(defaultFitFullImage);
  const [isPending, startTransition] = useTransition();
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const fitMode: FitMode = fitFullImage ? "contain" : "cover";

  function resetLayout(
    size: { width: number; height: number },
    mode: FitMode,
    nextZoom = MIN_ZOOM,
  ) {
    const rendered = getRenderedSize(size.width, size.height, nextZoom, mode);
    setZoom(nextZoom);
    setOffset(centerOffset(rendered.width, rendered.height));
  }

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setFitFullImage(defaultFitFullImage);

    void getImageSize(file)
      .then((size) => {
        if (cancelled) return;
        const mode: FitMode = defaultFitFullImage ? "contain" : "cover";
        setImgSize(size);
        resetLayout(size, mode);
      })
      .catch(() => {
        if (!cancelled) onCancel();
      });

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
      dragRef.current = null;
    };
    // onCancel viene del padre; no re-inicializar al re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    if (!imgSize) return;
    resetLayout(imgSize, fitMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitFullImage]);

  function updateZoom(nextZoom: number) {
    if (!imgSize || fitFullImage) return;
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const prev = getRenderedSize(imgSize.width, imgSize.height, zoom, fitMode);
    const next = getRenderedSize(
      imgSize.width,
      imgSize.height,
      clampedZoom,
      fitMode,
    );
    const centerX = VIEWPORT_PX / 2;
    const centerY = VIEWPORT_PX / 2;
    const imageX = (centerX - offset.x) / prev.width;
    const imageY = (centerY - offset.y) / prev.height;
    const nextOffset = {
      x: centerX - imageX * next.width,
      y: centerY - imageY * next.height,
    };
    setZoom(clampedZoom);
    setOffset(clampOffset(nextOffset, next.width, next.height));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!imgSize || fitFullImage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !imgSize || fitFullImage) {
      return;
    }
    const rendered = getRenderedSize(imgSize.width, imgSize.height, zoom, fitMode);
    setOffset(
      clampOffset(
        {
          x: drag.origX + (e.clientX - drag.startX),
          y: drag.origY + (e.clientY - drag.startY),
        },
        rendered.width,
        rendered.height,
      ),
    );
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function applyCrop() {
    if (!imgSize) return;
    const crop: AvatarCropParams = {
      offsetX: offset.x,
      offsetY: offset.y,
      zoom,
      viewportPx: VIEWPORT_PX,
      fitMode,
    };
    startTransition(async () => {
      try {
        const cropped = await exportAvatarCrop(file, crop, compressOptions);
        onConfirm(cropped);
      } catch {
        onCancel();
      }
    });
  }

  const rendered = imgSize
    ? getRenderedSize(imgSize.width, imgSize.height, zoom, fitMode)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "relative mx-auto size-[280px] touch-none overflow-hidden border bg-muted",
          shape === "circle" ? "rounded-full" : "rounded-lg",
          isPending && "opacity-70",
          fitFullImage && "cursor-default",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {previewUrl && rendered && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Vista previa"
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              width: rendered.width,
              height: rendered.height,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        )}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 ring-2 ring-background/80 ring-inset",
            shape === "circle" ? "rounded-full" : "rounded-lg",
          )}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {fitFullImage
          ? "La imagen completa se ajusta al recuadro sin deformar proporciones."
          : hint}
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={fitFullImage}
          disabled={!imgSize || isPending}
          onCheckedChange={(v) => setFitFullImage(v === true)}
        />
        Encuadrar imagen completa
      </label>

      {!fitFullImage && (
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-2 text-xs text-muted-foreground">
            <ZoomIn className="size-3.5" />
            Zoom
          </Label>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!imgSize || isPending}
            onChange={(e) => updateZoom(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
        >
          Volver
        </Button>
        <Button
          type="button"
          disabled={!imgSize || isPending}
          onClick={applyCrop}
        >
          {isPending ? "Procesando..." : "Usar foto"}
        </Button>
      </div>
    </div>
  );
}
