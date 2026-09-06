"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  formatSignedDiff,
  orderAfterPickingPlace,
  type ZoneStandingRow,
  type ZoneStandingsResult,
} from "@/modules/tournaments/domain/zone-standings";
import type { ZonePairOption } from "./zone-card";

function pairName(pairId: string, options: ZonePairOption[]): string {
  return options.find((option) => option.id === pairId)?.label ?? "Pareja";
}

function outcomeClass(row: ZoneStandingRow): string {
  if (row.outcome === "advance") {
    return "border-teal-300 bg-teal-100 text-teal-950 dark:border-teal-700 dark:bg-teal-900/50 dark:text-teal-100";
  }
  if (row.outcome === "out") {
    return "border-red-300 bg-red-100 text-red-950 dark:border-red-700 dark:bg-red-900/50 dark:text-red-100";
  }
  if (row.outcome === "playoff") {
    return "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-100";
  }
  return "border-border bg-muted text-muted-foreground";
}

function groupPairIds(rows: ZoneStandingRow[], key: string): string[] {
  return rows.filter((row) => row.tieGroupKey === key).map((row) => row.pairId);
}

export function ZoneStandingsDialog({
  open,
  onOpenChange,
  zoneLabel,
  pairOptions,
  standings,
  readOnly = false,
  onDefineTie,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoneLabel: string;
  pairOptions: ZonePairOption[];
  standings: ZoneStandingsResult;
  readOnly?: boolean;
  onDefineTie?: (groupPairIds: string[], orderedPairIds: string[]) => void;
}) {
  const provisional = standings.pendingMatches > 0;

  function definePlace(row: ZoneStandingRow, absolutePlace: number) {
    if (
      !onDefineTie ||
      !row.tieGroupKey ||
      row.tieGroupStart == null ||
      !row.tieGroupSize
    ) {
      return;
    }
    const groupIds = groupPairIds(standings.rows, row.tieGroupKey);
    const previousOrder = standings.rows
      .filter((item) => item.tieGroupKey === row.tieGroupKey && item.courtDefined)
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      .map((item) => item.pairId);
    const ordered = orderAfterPickingPlace(
      groupIds,
      row.pairId,
      absolutePlace - row.tieGroupStart,
      previousOrder,
    );
    onDefineTie(groupIds, ordered);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Clasificación · {zoneLabel}</DialogTitle>
          <DialogDescription>
            {standings.regulation} · pasan {standings.advancers}
            {provisional ? " · provisoria" : ""} · {standings.completeMatches}/
            {standings.totalMatches} partido
            {standings.totalMatches === 1 ? "" : "s"} con resultado
          </DialogDescription>
        </DialogHeader>

        {standings.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay parejas en esta zona.
          </p>
        ) : standings.completeMatches === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cargá los marcadores de los partidos para calcular quién pasa y
            quién queda afuera.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-[11px] text-muted-foreground">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Pareja</th>
                  <th className="px-2 py-2 text-center font-medium">Pts</th>
                  <th className="px-2 py-2 text-center font-medium">Sets</th>
                  <th className="px-2 py-2 text-center font-medium">
                    Diff. sets
                  </th>
                  <th className="px-2 py-2 text-center font-medium">Games</th>
                  <th className="px-2 py-2 text-center font-medium">
                    Diff. games
                  </th>
                  <th className="px-2 py-2 font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {standings.rows.map((row) => {
                  const canDefine =
                    !readOnly &&
                    Boolean(onDefineTie) &&
                    Boolean(row.tieGroupKey) &&
                    row.tieGroupStart != null &&
                    (row.tieGroupSize ?? 0) > 1;
                  const start = row.tieGroupStart ?? 1;
                  const size = row.tieGroupSize ?? 0;
                  return (
                    <tr
                      key={row.pairId}
                      className="border-b border-dashed last:border-0"
                    >
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">
                        {row.rank ?? "—"}
                      </td>
                      <td className="px-2 py-2 font-medium">
                        {pairName(row.pairId, pairOptions)}
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {row.won}G · {row.lost}P · {row.played} jugado
                          {row.played === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">
                        {row.points}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">
                        {row.setsWon}–{row.setsLost}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">
                        {formatSignedDiff(row.setDiff)}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">
                        {row.gamesFor}–{row.gamesAgainst}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">
                        {formatSignedDiff(row.gameDiff)}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
                            outcomeClass(row),
                          )}
                        >
                          {row.outcomeLabel}
                        </span>
                        {canDefine ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {Array.from({ length: size }, (_, offset) => {
                              const place = start + offset;
                              const active = row.rank === place;
                              return (
                                <button
                                  key={place}
                                  type="button"
                                  className={cn(
                                    "inline-flex h-6 min-w-8 items-center justify-center rounded-md border px-1.5 text-[11px] font-medium",
                                    active
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-background hover:bg-muted",
                                  )}
                                  onClick={() => definePlace(row, place)}
                                >
                                  {place}.ª
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {standings.pendingReasons.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-xs text-amber-800 dark:text-amber-200">
            {standings.pendingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}

        <p className="text-xs text-muted-foreground">{standings.note}</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
