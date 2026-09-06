"use client";

import { useMemo } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AyudaButton } from "./ayuda-button";
import { STICKY_PANEL_CARD, STICKY_PANEL_HEADER } from "./sticky-panel";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { GrillaPdfMenu } from "./grilla-pdf-menu";
import {
  buildZonesMatchGridRows,
  formatGridCourt,
  formatGridHorario,
} from "./zones-match-grid-model";

export function ZonesMatchGridPanel({
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
  const rows = useMemo(
    () => buildZonesMatchGridRows({ categories, pairs, config }),
    [categories, config, pairs],
  );

  return (
    <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle>Grilla</CardTitle>
        <CardAction>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <GrillaPdfMenu tournamentName={tournamentName} rows={rows} />
            <AyudaButton
              title="Ayuda de grilla"
              description="Cómo se ordenan los partidos de zonas."
            >
              <p>
                Orden de largada de los partidos. A igual horario, primero
                Cancha 1 y después Cancha 2.
              </p>
            </AyudaButton>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay un armado de zonas. Actualizá las categorías para
            generar la grilla.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs text-muted-foreground">
              {rows.length} partido{rows.length === 1 ? "" : "s"}
            </p>
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground">
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">Índice</th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">Horario</th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">Cancha</th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">Categoría</th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">Zona</th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">Número</th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">Pareja 1</th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">Pareja 2</th>
                  <th className="py-1.5 text-center align-middle font-medium">Observación</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-b border-dashed last:border-0"
                  >
                    <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatGridHorario(row)}
                    </td>
                    <td className="py-2 pr-3">{formatGridCourt(row)}</td>
                    <td className="py-2 pr-3 text-center align-middle">
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: row.categoryColor }}
                          aria-hidden
                        />
                        {row.categoryLabel}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{row.zoneLetter}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.matchNumber}</td>
                    <td className="py-2 pr-3">{row.pair1}</td>
                    <td className="py-2 pr-3">{row.pair2}</td>
                    <td className="py-2 text-muted-foreground">
                      {row.observation || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
