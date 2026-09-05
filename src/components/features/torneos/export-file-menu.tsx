"use client";

import { useState } from "react";
import { ClipboardCopy, ExternalLink, FileDown, FileImage, FilePlus } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { GrillaPdfAction } from "./zones-match-grid-pdf";

export function ExportFileMenu({
  format,
  disabled,
  align = "start",
  onAction,
}: {
  format: "pdf" | "png";
  disabled?: boolean;
  align?: "start" | "end";
  onAction: (action: GrillaPdfAction) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const label = format.toUpperCase();

  async function handle(action: GrillaPdfAction) {
    if (busy) return;
    setBusy(true);
    try {
      await onAction(action);
      if (action === "copy") {
        toast.success(`${label} copiado`, {
          description: "Pegaló en WhatsApp con Ctrl+V.",
        });
      }
    } catch (error) {
      toast.error(
        action === "copy"
          ? `No se pudo copiar el ${label}`
          : `No se pudo generar el ${label}`,
        {
          description:
            error instanceof Error ? error.message : "Error inesperado",
        },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || busy}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "shrink-0",
        )}
      >
        {format === "pdf" ? <FileDown /> : <FileImage />}
        {busy ? `${label}…` : label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-auto min-w-52">
        <DropdownMenuItem onClick={() => void handle("open")}>
          <ExternalLink />
          Abrir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handle("create-open")}>
          <FilePlus />
          Crear y Abrir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handle("copy")}>
          <ClipboardCopy />
          Copiar a Portapapeles
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
