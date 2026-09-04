"use client";

import { useState } from "react";
import { ClipboardCopy, ExternalLink, FileDown, FilePlus } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  runLlavePdfAction,
  type LlavePdfClub,
  type LlavePdfDraw,
} from "./llave-pdf";
import type { GrillaPdfAction } from "./zones-match-grid-pdf";

export function LlavePdfMenu({
  tournamentName,
  draws,
  club,
}: {
  tournamentName: string;
  draws: LlavePdfDraw[];
  club?: LlavePdfClub;
}) {
  const [busy, setBusy] = useState(false);

  async function handlePdf(action: GrillaPdfAction) {
    if (busy) return;
    setBusy(true);
    try {
      await runLlavePdfAction({ action, tournamentName, draws, club });
      if (action === "copy") {
        toast.success("Llave copiada", {
          description: "Pegala en WhatsApp con Ctrl+V.",
        });
      }
    } catch (error) {
      toast.error(
        action === "copy"
          ? "No se pudo copiar la llave"
          : "No se pudo generar el PDF",
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
        disabled={draws.length === 0 || busy}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "shrink-0",
        )}
      >
        <FileDown />
        {busy ? "PDF…" : "PDF"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-52">
        <DropdownMenuItem onClick={() => void handlePdf("open")}>
          <ExternalLink />
          Abrir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handlePdf("create-open")}>
          <FilePlus />
          Crear y Abrir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handlePdf("copy")}>
          <ClipboardCopy />
          Copiar a Portapapeles
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
