"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AyudaButton } from "./ayuda-button";
import { STICKY_PANEL_CARD, STICKY_PANEL_HEADER } from "./sticky-panel";
import { cn } from "@/lib/utils";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  clampDailyMatchesPngColumns,
  runDailyMatchesPdfAction,
  runDailyMatchesPngAction,
  type DailyMatchesClub,
} from "./daily-matches-export";
import {
  buildDailyMatchCards,
  DAILY_PHASE_LABELS,
  type DailyMatchCard,
  type DailyMatchPhase,
} from "./daily-matches-model";
import { ExportFileMenu } from "./export-file-menu";

const PNG_COLUMN_OPTIONS = [1, 2, 3, 4] as const;

const PHASE_CARD: Record<DailyMatchPhase, string> = {
  zonas:
    "border-teal-200/80 bg-teal-50/80 dark:border-teal-900 dark:bg-teal-950/30",
  intermedia:
    "border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
  final:
    "border-violet-400 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40",
};

const PHASE_BADGE: Record<DailyMatchPhase, string> = {
  zonas:
    "border-teal-200 bg-teal-100 text-teal-950 dark:border-teal-800 dark:bg-teal-900/60 dark:text-teal-100",
  intermedia:
    "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  final:
    "border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-800 dark:bg-violet-900/60 dark:text-violet-100",
};

function MatchCard({ card }: { card: DailyMatchCard }) {
  const court =
    card.courtIndex == null ? "Sin cancha" : `Cancha ${card.courtIndex + 1}`;
  const time = card.startTime.trim() || "Sin horario";

  return (
    <article
      className={cn(
        "flex min-h-[11rem] flex-col rounded-lg border p-3",
        PHASE_CARD[card.phase],
      )}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold tabular-nums">
            {time}
            <span className="font-normal text-muted-foreground"> · {court}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: card.categoryColor }}
              aria-hidden
            />
            {card.categoryLabel} · {card.groupLabel}
            {card.matchNumber ? ` · n° ${card.matchNumber}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
            PHASE_BADGE[card.phase],
          )}
        >
          {DAILY_PHASE_LABELS[card.phase]}
        </span>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <p className="rounded-md border border-background/80 bg-background/80 px-2 py-2 text-center text-base font-medium">
          {card.pair1 || "—"}
        </p>
        <p className="text-center text-xs text-muted-foreground">vs</p>
        <p className="rounded-md border border-background/80 bg-background/80 px-2 py-2 text-center text-base font-medium">
          {card.pair2 || "—"}
        </p>
      </div>

      {card.observation ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {card.observation}
        </p>
      ) : null}
    </article>
  );
}

export function DailyMatchesPanel({
  tournamentName,
  dayLabel,
  categories,
  pairs,
  config,
  playDate,
  club,
}: {
  tournamentName: string;
  dayLabel: string;
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  playDate: string;
  club?: DailyMatchesClub;
}) {
  const cards = useMemo(
    () => buildDailyMatchCards({ categories, pairs, config, playDate }),
    [categories, config, pairs, playDate],
  );
  const [pngColumnsOpen, setPngColumnsOpen] = useState(false);
  const [pngColumns, setPngColumns] = useState(2);
  const [pngBusy, setPngBusy] = useState(false);

  async function createAndOpenPng() {
    if (pngBusy) return;
    setPngBusy(true);
    try {
      await runDailyMatchesPngAction({
        action: "create-open",
        tournamentName,
        dayLabel,
        cards,
        club,
        columns: clampDailyMatchesPngColumns(pngColumns),
      });
      setPngColumnsOpen(false);
    } catch (error) {
      toast.error("No se pudo generar el PNG", {
        description:
          error instanceof Error ? error.message : "Error inesperado",
      });
    } finally {
      setPngBusy(false);
    }
  }

  return (
    <>
      <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          Partidos del día{dayLabel ? ` · ${dayLabel}` : ""}
        </CardTitle>
        <CardAction>
          <div className="flex shrink-0 items-center gap-2">
            <ExportFileMenu
              format="pdf"
              align="end"
              disabled={cards.length === 0}
              onAction={(action) =>
                runDailyMatchesPdfAction({
                  action,
                  tournamentName,
                  dayLabel,
                  cards,
                  club,
                })
              }
            />
            <ExportFileMenu
              format="png"
              align="end"
              disabled={cards.length === 0}
              onAction={(action) => {
                if (action === "create-open") {
                  setPngColumnsOpen(true);
                  return Promise.resolve();
                }
                return runDailyMatchesPngAction({
                  action,
                  tournamentName,
                  dayLabel,
                  cards,
                  club,
                });
              }}
            />
            <AyudaButton
              title="Ayuda de partidos del día"
              description="Qué se muestra en esta jornada."
            >
              <p>
                Enfrentamientos de zonas, intermedia y final programados para
                este día, en orden de horario y cancha.
              </p>
            </AyudaButton>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay partidos armados para este día. Actualizá las fases
            para asignar horarios.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {cards.length} enfrentamiento{cards.length === 1 ? "" : "s"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <MatchCard key={card.id} card={card} />
              ))}
            </div>
          </>
        )}
      </CardContent>
      </Card>
      <Dialog
        open={pngColumnsOpen}
        onOpenChange={(open) => {
          if (pngBusy) return;
          setPngColumnsOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar PNG</DialogTitle>
            <DialogDescription>
              Indicá cuántas columnas de tarjetas querés. La imagen se recorta
              al tamaño de las tarjetas, lista para WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>Columnas</Label>
            <div className="flex flex-wrap gap-2">
              {PNG_COLUMN_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={pngColumns === option ? "default" : "outline"}
                  size="sm"
                  aria-pressed={pngColumns === option}
                  onClick={() => setPngColumns(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pngBusy}
              onClick={() => setPngColumnsOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={pngBusy} onClick={() => void createAndOpenPng()}>
              {pngBusy ? "Creando…" : "Crear y Abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
