"use client";

import { useMemo, useState } from "react";
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
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { buildZonesMatchGridRows } from "./zones-match-grid-model";
import {
  runGrillaPdfAction,
  type GrillaPdfAction,
} from "./zones-match-grid-pdf";

export function GrillaPdfMenu({
  tournamentName,
  categories,
  pairs,
  config,
}: {
  tournamentName: string;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
}) {
  const [busy, setBusy] = useState(false);
  const rows = useMemo(
    () => buildZonesMatchGridRows({ categories, pairs, config }),
    [categories, config, pairs],
  );

  async function handlePdf(action: GrillaPdfAction) {
    if (busy) return;
    setBusy(true);
    try {
      await runGrillaPdfAction({ action, tournamentName, rows });
      if (action === "copy") {
        toast.success("Grilla copiada", {
          description: "Pegala en WhatsApp con Ctrl+V.",
        });
      }
    } catch (error) {
      toast.error(
        action === "copy"
          ? "No se pudo copiar la grilla"
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
        disabled={rows.length === 0 || busy}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "shrink-0",
        )}
      >
        <FileDown />
        {busy ? "PDF…" : "PDF"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-52">
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
