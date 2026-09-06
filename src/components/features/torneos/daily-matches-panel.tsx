"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  categoryCardTone,
  dailyMatchesExportHeadline,
  DAILY_EXPORT_COLUMN_OPTIONS,
  DAILY_FILTER_ALL,
  filterDailyMatchCards,
  listDailyInstanceOptions,
  type DailyInstanceOption,
  type DailyMatchCard,
  type DailyMatchPhase,
} from "./daily-matches-model";
import { ExportFileMenu } from "./export-file-menu";

const FILTER_SELECT_CLASS =
  "h-8 max-w-[18rem] shrink-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function gridColsClass(columns: number) {
  if (columns === 1) return "grid-cols-1";
  if (columns === 3) return "grid-cols-3";
  if (columns === 4) return "grid-cols-4";
  return "grid-cols-2";
}

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
  const tone = categoryCardTone(card.categoryColor);

  return (
    <article
      className="flex min-h-[11rem] flex-col rounded-lg border p-3"
      style={{
        backgroundColor: tone.fillCss,
        borderColor: tone.borderCss,
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
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
            {card.categoryLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
              PHASE_BADGE[card.phase],
            )}
          >
            {card.instanceLabel || card.groupLabel}
          </span>
          {card.matchNumber ? (
            <p className="text-[13px] text-muted-foreground">
              nº {card.matchNumber}
            </p>
          ) : null}
        </div>
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

export function useDailyMatchesFilters({
  categories,
  pairs,
  config,
  playDate,
}: {
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  playDate: string;
}) {
  const [categoryId, setCategoryId] = useState(DAILY_FILTER_ALL);
  const [instanceKey, setInstanceKey] = useState(DAILY_FILTER_ALL);
  const [columns, setColumns] = useState(2);

  const dayCards = useMemo(
    () => buildDailyMatchCards({ categories, pairs, config, playDate }),
    [categories, config, pairs, playDate],
  );
  const instanceOptions = useMemo(
    () =>
      listDailyInstanceOptions(
        filterDailyMatchCards(dayCards, {
          categoryId,
          instanceKey: DAILY_FILTER_ALL,
        }),
      ),
    [categoryId, dayCards],
  );
  const cards = useMemo(
    () => filterDailyMatchCards(dayCards, { categoryId, instanceKey }),
    [categoryId, dayCards, instanceKey],
  );

  useEffect(() => {
    if (categoryId === DAILY_FILTER_ALL) return;
    if (!categories.some((category) => category.id === categoryId)) {
      setCategoryId(DAILY_FILTER_ALL);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (instanceKey === DAILY_FILTER_ALL) return;
    if (!instanceOptions.some((option) => option.key === instanceKey)) {
      setInstanceKey(DAILY_FILTER_ALL);
    }
  }, [instanceKey, instanceOptions]);

  return {
    categoryId,
    setCategoryId,
    instanceKey,
    setInstanceKey,
    columns,
    setColumns,
    instanceOptions,
    cards,
    dayHasMatches: dayCards.length > 0,
  };
}

export function DailyMatchesFilterSelects({
  categories,
  categoryId,
  onCategoryIdChange,
  instanceOptions,
  instanceKey,
  onInstanceKeyChange,
  columns,
  onColumnsChange,
}: {
  categories: TournamentCategoryItem[];
  categoryId: string;
  onCategoryIdChange: (value: string) => void;
  instanceOptions: DailyInstanceOption[];
  instanceKey: string;
  onInstanceKeyChange: (value: string) => void;
  columns: number;
  onColumnsChange: (value: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <select
        className={FILTER_SELECT_CLASS}
        value={categoryId}
        onChange={(event) => onCategoryIdChange(event.target.value)}
        aria-label="Categorías"
        title="Categorías"
      >
        <option value={DAILY_FILTER_ALL}>Todas las categorías</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <select
        className={FILTER_SELECT_CLASS}
        value={instanceKey}
        onChange={(event) => onInstanceKeyChange(event.target.value)}
        aria-label="Instancias a publicar"
        title="Instancias a publicar"
      >
        <option value={DAILY_FILTER_ALL}>Todas las instancias</option>
        {instanceOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        className={FILTER_SELECT_CLASS}
        value={String(columns)}
        onChange={(event) =>
          onColumnsChange(clampDailyMatchesPngColumns(Number(event.target.value)))
        }
        aria-label="Columnas de exportación"
        title="Columnas de exportación"
      >
        {DAILY_EXPORT_COLUMN_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === 1 ? "1 columna" : `${option} columnas`}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DailyMatchesPanel({
  tournamentName,
  dayLabel,
  categories,
  categoryId,
  instanceOptions,
  instanceKey,
  cards,
  dayHasMatches,
  columns,
  club,
}: {
  tournamentName: string;
  dayLabel: string;
  categories: TournamentCategoryItem[];
  categoryId: string;
  instanceOptions: DailyInstanceOption[];
  instanceKey: string;
  cards: DailyMatchCard[];
  dayHasMatches: boolean;
  columns: number;
  club?: DailyMatchesClub;
}) {
  const exportColumns = clampDailyMatchesPngColumns(columns);
  const headline = dailyMatchesExportHeadline({
    dayLabel,
    categories,
    categoryId,
    instanceOptions,
    instanceKey,
  });

  return (
    <Card className={STICKY_PANEL_CARD}>
      <CardHeader className={STICKY_PANEL_HEADER}>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          {headline}
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
                  headline,
                  cards,
                  club,
                  columns: exportColumns,
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
                  headline,
                  cards,
                  club,
                  columns: exportColumns,
                })
              }
            />
            <AyudaButton
              title="Ayuda de partidos del día"
              description="Qué se muestra en esta jornada."
            >
              <p>
                Enfrentamientos de zonas, intermedia y final programados para
                este día, en orden de horario y cancha.
              </p>
              <p>
                Filtrá por categoría e instancia. Las columnas cambian la
                grilla en pantalla y también el PDF y el PNG.
              </p>
            </AyudaButton>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {dayHasMatches
              ? "Ningún enfrentamiento coincide con los filtros."
              : "Todavía no hay partidos armados para este día. Actualizá las fases para asignar horarios."}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {cards.length} enfrentamiento{cards.length === 1 ? "" : "s"}
            </p>
            <div className={cn("grid gap-3", gridColsClass(exportColumns))}>
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
