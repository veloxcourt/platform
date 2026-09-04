"use client";

import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { GrillaPdfMenu } from "./grilla-pdf-menu";
import {
  buildFinalMatchGridRows,
  toGrillaPdfRows,
} from "./final-match-grid-model";
import { formatGridCourt, formatGridHorario } from "./zones-match-grid-model";

export function FinalMatchGridPanel({
  tournamentName,
  categories,
  zoneCategories,
  pairs,
  config,
}: {
  tournamentName: string;
  categories: TournamentCategoryItem[];
  zoneCategories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
}) {
  const [includeZones, setIncludeZones] = useState(false);
  const [includeIntermediate, setIncludeIntermediate] = useState(false);
  const rows = useMemo(
    () =>
      buildFinalMatchGridRows({
        categories,
        zoneCategories,
        pairs,
        config,
        includeZones,
        includeIntermediate,
      }),
    [
      categories,
      config,
      includeIntermediate,
      includeZones,
      pairs,
      zoneCategories,
    ],
  );
  const pdfRows = useMemo(() => toGrillaPdfRows(rows), [rows]);
  const groupColumnLabel =
    includeZones || includeIntermediate ? "Zona / Ronda" : "Ronda";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Grilla</CardTitle>
          <CardDescription>
            Orden de los cruces de fase final. Día, horario y cancha salen de
            Actualizar.{" "}
            <span className="font-medium text-foreground">
              Incluir fases anteriores
            </span>{" "}
            arma la grilla completa.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
            <Checkbox
              checked={includeZones}
              onCheckedChange={(value) => setIncludeZones(value === true)}
              aria-label="Incluir partidos de Zona"
            />
            Incluir partidos de Zona
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
            <Checkbox
              checked={includeIntermediate}
              onCheckedChange={(value) =>
                setIncludeIntermediate(value === true)
              }
              aria-label="Incluir fase intermedia"
            />
            Incluir fase intermedia
          </label>
          <GrillaPdfMenu
            tournamentName={tournamentName}
            rows={pdfRows}
            groupColumnLabel={groupColumnLabel}
          />
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {includeZones || includeIntermediate
              ? "Todavía no hay partidos de fases anteriores ni de fase final."
              : "Ninguna categoría tiene partidos de fase final."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs text-muted-foreground">
              {rows.length} partido{rows.length === 1 ? "" : "s"}
            </p>
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-[11px] text-muted-foreground">
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">
                    Índice
                  </th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">
                    Horario
                  </th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">
                    Cancha
                  </th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">
                    Categoría
                  </th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">
                    {groupColumnLabel}
                  </th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">
                    Número
                  </th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">
                    Pareja 1
                  </th>
                  <th className="py-1.5 pr-3 text-center align-middle font-medium">
                    Pareja 2
                  </th>
                  <th className="py-1.5 text-center align-middle font-medium">
                    Observación
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-b border-dashed last:border-0"
                  >
                    <td className="py-2 pr-3 text-center tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-2 pr-3 text-center">
                      {formatGridHorario({
                        playDate: row.playDate ?? "",
                        startTime: row.startTime ?? "",
                      })}
                    </td>
                    <td className="py-2 pr-3 text-center">
                      {includeZones || includeIntermediate
                        ? formatGridCourt(row)
                        : row.courtIndex == null
                          ? "—"
                          : `Cancha ${row.courtIndex + 1}`}
                    </td>
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
                    <td className="py-2 pr-3 text-center">{row.roundLabel}</td>
                    <td className="py-2 pr-3 text-center tabular-nums">
                      {row.matchNumber}
                    </td>
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
