"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Botón de pestaña con caja fija: no salta al activarse ni al recibir foco. */
export function StableTabButton({
  active,
  children,
  onSelect,
  className,
}: {
  active: boolean;
  children: ReactNode;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      // Evita que el foco desplace el scroll horizontal de la fila.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
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
