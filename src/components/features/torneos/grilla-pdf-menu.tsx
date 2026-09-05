"use client";

import { ExportFileMenu } from "./export-file-menu";
import type { ZonesMatchGridRow } from "./zones-match-grid-model";
import { runGrillaPdfAction, runGrillaPngAction } from "./zones-match-grid-pdf";

export function GrillaPdfMenu({
  tournamentName,
  rows,
  groupColumnLabel = "Zona",
}: {
  tournamentName: string;
  rows: ZonesMatchGridRow[];
  groupColumnLabel?: string;
}) {
  const disabled = rows.length === 0;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ExportFileMenu
        format="pdf"
        disabled={disabled}
        align="end"
        onAction={(action) =>
          runGrillaPdfAction({
            action,
            tournamentName,
            rows,
            groupColumnLabel,
          })
        }
      />
      <ExportFileMenu
        format="png"
        disabled={disabled}
        align="end"
        onAction={(action) =>
          runGrillaPngAction({
            action,
            tournamentName,
            rows,
            groupColumnLabel,
          })
        }
      />
    </div>
  );
}
