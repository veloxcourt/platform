"use client";

import { ExportFileMenu } from "./export-file-menu";
import {
  runZonesCardsPdfAction,
  runZonesCardsPngAction,
  type ZonesCardsPdfInput,
} from "./zones-cards-pdf";

export function ZonesCardsPdfMenu({ input }: { input: ZonesCardsPdfInput }) {
  const disabled = input.zones.length === 0;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ExportFileMenu
        format="pdf"
        disabled={disabled}
        align="end"
        onAction={(action) => runZonesCardsPdfAction({ action, input })}
      />
      <ExportFileMenu
        format="png"
        disabled={disabled}
        align="end"
        onAction={(action) => runZonesCardsPngAction({ action, input })}
      />
    </div>
  );
}
