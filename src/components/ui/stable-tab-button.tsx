"use client";

import type {
  MouseEvent,
  PointerEventHandler,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/** Botón de pestaña con caja fija: no salta al activarse ni al recibir foco. */
export function StableTabButton({
  active,
  children,
  onSelect,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  className,
  title,
}: {
  active: boolean;
  children: ReactNode;
  onSelect: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPointerMove?: PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: PointerEventHandler<HTMLButtonElement>;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title}
      // Evita que el foco desplace el scroll horizontal de la fila.
      onMouseDown={(event) => {
        if (event.button === 0) event.preventDefault();
      }}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg border px-2.5 text-[0.8rem] font-medium whitespace-nowrap",
        "outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
