import { formatWeekday } from "@/lib/date";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { buildFinalMatchGridRows } from "./final-match-grid-model";
import { buildIntermediateMatchGridRows } from "./intermediate-match-grid-model";
import { buildZonesMatchGridRows } from "./zones-match-grid-model";

export type DailyMatchPhase = "zonas" | "intermedia" | "final";

export const DAILY_PHASE_LABELS: Record<DailyMatchPhase, string> = {
  zonas: "Zonas",
  intermedia: "Intermedia",
  final: "Final",
};

export type DailyMatchCard = {
  id: string;
  playDate: string;
  startTime: string;
  courtIndex: number | null;
  categoryLabel: string;
  categoryColor: string;
  phase: DailyMatchPhase;
  groupLabel: string;
  matchNumber: number;
  pair1: string;
  pair2: string;
  observation: string;
};

export type DailyPlayDayOption = {
  date: string;
  label: string;
};

export function tournamentPlayDayOptions(
  config: TournamentConfig | null,
): DailyPlayDayOption[] {
  return (config?.playDays ?? [])
    .filter((day) => day.date)
    .map((day, index) => ({
      date: day.date,
      label: `D${index + 1} · ${formatWeekday(day.date)}`,
    }));
}

export function buildDailyMatchCards({
  categories,
  pairs,
  config,
  playDate,
}: {
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  playDate: string;
}): DailyMatchCard[] {
  const dayOpenByDate: Record<string, string> = {};
  for (const day of config?.playDays ?? []) {
    if (day.date) dayOpenByDate[day.date] = day.startTime;
  }

  const zones = buildZonesMatchGridRows({ categories, pairs, config }).map(
    (row): DailyMatchCard => ({
      id: `zonas-${row.id}`,
      playDate: row.playDate,
      startTime: row.startTime,
      courtIndex: row.courtIndex,
      categoryLabel: row.categoryLabel,
      categoryColor: row.categoryColor,
      phase: "zonas",
      groupLabel: row.zoneLetter ? `Zona ${row.zoneLetter}` : "Zona",
      matchNumber: row.matchNumber,
      pair1: row.pair1,
      pair2: row.pair2,
      observation: row.observation,
    }),
  );

  const intermediate = buildIntermediateMatchGridRows({
    categories,
    zoneCategories: categories,
    pairs,
    config,
  }).map(
    (row): DailyMatchCard => ({
      id: `intermedia-${row.id}`,
      playDate: row.playDate ?? "",
      startTime: row.startTime ?? "",
      courtIndex: row.courtIndex,
      categoryLabel: row.categoryLabel,
      categoryColor: row.categoryColor,
      phase: "intermedia",
      groupLabel: row.roundLabel,
      matchNumber: row.officialId || row.matchNumber,
      pair1: row.pair1,
      pair2: row.pair2,
      observation: row.observation,
    }),
  );

  const finals = buildFinalMatchGridRows({
    categories,
    zoneCategories: categories,
    pairs,
    config,
  }).map(
    (row): DailyMatchCard => ({
      id: `final-${row.id}`,
      playDate: row.playDate ?? "",
      startTime: row.startTime ?? "",
      courtIndex: row.courtIndex,
      categoryLabel: row.categoryLabel,
      categoryColor: row.categoryColor,
      phase: "final",
      groupLabel: row.roundLabel,
      matchNumber: row.officialId || row.matchNumber,
      pair1: row.pair1,
      pair2: row.pair2,
      observation: row.observation,
    }),
  );

  return [...zones, ...intermediate, ...finals]
    .filter((card) => card.playDate === playDate)
    .sort((a, b) => {
      const schedule = comparePlayDaySchedule(a, b, dayOpenByDate);
      if (schedule !== 0) return schedule;
      const courtA = a.courtIndex ?? Number.MAX_SAFE_INTEGER;
      const courtB = b.courtIndex ?? Number.MAX_SAFE_INTEGER;
      if (courtA !== courtB) return courtA - courtB;
      return a.categoryLabel.localeCompare(b.categoryLabel, "es");
    });
}
