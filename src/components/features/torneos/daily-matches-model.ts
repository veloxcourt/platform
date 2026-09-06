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

export type DailyRgb = [number, number, number];

export function parseHexColor(hex: string): DailyRgb | null {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => part + part)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function mixRgb(from: DailyRgb, toward: DailyRgb, amount: number): DailyRgb {
  return [
    Math.round(from[0] + (toward[0] - from[0]) * amount),
    Math.round(from[1] + (toward[1] - from[1]) * amount),
    Math.round(from[2] + (toward[2] - from[2]) * amount),
  ];
}

function rgbCss(rgb: DailyRgb) {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

/// Fondo y borde claros a partir del color de la categoría.
export function categoryCardTone(hex: string) {
  const rgb = parseHexColor(hex) ?? [100, 116, 139];
  const fill = mixRgb(rgb, [255, 255, 255], 0.78);
  const border = mixRgb(rgb, [255, 255, 255], 0.4);
  return {
    fill,
    border,
    fillCss: rgbCss(fill),
    borderCss: rgbCss(border),
  };
}

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
