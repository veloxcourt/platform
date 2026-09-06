"use client";

import { ExportFileMenu } from "./export-file-menu";
import {
  runLlavePdfAction,
  runLlavePngAction,
  type LlavePdfClub,
  type LlavePdfDraw,
} from "./llave-pdf";

export function LlavePdfMenu({
  tournamentName,
  draws,
  club,
  align = "end",
}: {
  tournamentName: string;
  draws: LlavePdfDraw[];
  club?: LlavePdfClub;
  align?: "start" | "end";
}) {
  const disabled = draws.length === 0;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ExportFileMenu
        format="pdf"
        disabled={disabled}
        align={align}
        onAction={(action) =>
          runLlavePdfAction({ action, tournamentName, draws, club })
        }
      />
      <ExportFileMenu
        format="png"
        disabled={disabled}
        align={align}
        onAction={(action) =>
          runLlavePngAction({ action, tournamentName, draws, club })
        }
      />
    </div>
  );
}
