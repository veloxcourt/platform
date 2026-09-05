"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
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
        "flex min-h-[9.5rem] flex-col rounded-lg border p-3",
        PHASE_CARD[card.phase],
      )}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tabular-nums">
            {time}
            <span className="font-normal text-muted-foreground"> · {court}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
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
            "rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            PHASE_BADGE[card.phase],
          )}
        >
          {DAILY_PHASE_LABELS[card.phase]}
        </span>
      </div>

      <div className="mt-auto flex flex-col gap-1.5">
        <p className="rounded-md border border-background/80 bg-background/80 px-2 py-1.5 text-sm font-medium">
          {card.pair1 || "—"}
        </p>
        <p className="text-center text-[11px] text-muted-foreground">vs</p>
        <p className="rounded-md border border-background/80 bg-background/80 px-2 py-1.5 text-sm font-medium">
          {card.pair2 || "—"}
        </p>
      </div>

      {card.observation ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          Partidos del día{dayLabel ? ` · ${dayLabel}` : ""}
        </CardTitle>
        <CardDescription>
          Enfrentamientos de zonas, intermedia y final programados para este
          día, en orden de horario y cancha.
        </CardDescription>
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
              onAction={(action) =>
                runDailyMatchesPngAction({
                  action,
                  tournamentName,
                  dayLabel,
                  cards,
                  club,
                })
              }
            />
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
  );
}
