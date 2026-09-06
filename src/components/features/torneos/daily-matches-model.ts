import { formatWeekday } from "@/lib/date";
import { OFFICIAL_ROUND_ORDER } from "@/modules/tournaments/domain/intermediate-phase";
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

export const DAILY_FILTER_ALL = "all";
export const DAILY_ZONAS_INSTANCE_KEY = "zonas";
export const DAILY_EXPORT_COLUMN_OPTIONS = [1, 2, 3, 4] as const;

export type DailyMatchCard = {
  id: string;
  playDate: string;
  startTime: string;
  courtIndex: number | null;
  categoryId: string;
  categoryLabel: string;
  categoryColor: string;
  phase: DailyMatchPhase;
  instanceKey: string;
  instanceLabel: string;
  groupLabel: string;
  matchNumber: number;
  pair1: string;
  pair2: string;
  observation: string;
};

export type DailyInstanceOption = {
  key: string;
  label: string;
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

export function dailyDayHeadline(dayLabel: string): string {
  const match = /^D(\d+)/i.exec(dayLabel.trim());
  return match ? `DÍA ${match[1]}` : dayLabel.trim() || "Día";
}

export function isAllDailyInstances(instanceKeys: string[]): boolean {
  return instanceKeys.length === 0;
}

export function dailyInstanceSelectionLabel(
  instanceKeys: string[],
  instanceOptions: DailyInstanceOption[],
): string {
  if (isAllDailyInstances(instanceKeys)) return "Todas las instancias";
  const labels = instanceOptions
    .filter((option) => instanceKeys.includes(option.key))
    .map((option) => option.label);
  return labels.join(", ") || "Todas las instancias";
}

export function dailyMatchesExportHeadline({
  dayLabel,
  categories,
  categoryId,
  instanceOptions,
  instanceKeys,
}: {
  dayLabel: string;
  categories: TournamentCategoryItem[];
  categoryId: string;
  instanceOptions: DailyInstanceOption[];
  instanceKeys: string[];
}): string {
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const categoryLabel =
    categoryId === DAILY_FILTER_ALL
      ? "Todas las categorías"
      : selectedCategory?.name || selectedCategory?.abbreviation || "Categoría";
  return [
    dailyDayHeadline(dayLabel),
    categoryLabel,
    dailyInstanceSelectionLabel(instanceKeys, instanceOptions),
  ].join(" · ");
}

function categoryWrittenName(
  categoryId: string,
  fallback: string,
  categories: TournamentCategoryItem[],
): string {
  const category = categories.find((item) => item.id === categoryId);
  return category?.name.trim() || fallback;
}

function instanceOf(
  phase: DailyMatchPhase,
  groupLabel: string,
): DailyInstanceOption {
  if (phase === "zonas") {
    return {
      key: DAILY_ZONAS_INSTANCE_KEY,
      label: DAILY_PHASE_LABELS.zonas,
    };
  }
  return { key: groupLabel, label: groupLabel };
}

function instanceSortIndex(label: string): number {
  if (label === DAILY_PHASE_LABELS.zonas) return 0;
  const official = OFFICIAL_ROUND_ORDER.indexOf(
    label as (typeof OFFICIAL_ROUND_ORDER)[number],
  );
  return official === -1 ? OFFICIAL_ROUND_ORDER.length + 1 : official + 1;
}

export function listDailyInstanceOptions(
  cards: DailyMatchCard[],
): DailyInstanceOption[] {
  const unique = new Map<string, DailyInstanceOption>();
  for (const card of cards) {
    if (!unique.has(card.instanceKey)) {
      unique.set(card.instanceKey, {
        key: card.instanceKey,
        label: card.instanceLabel,
      });
    }
  }
  return [...unique.values()].sort((a, b) => {
    const order = instanceSortIndex(a.label) - instanceSortIndex(b.label);
    if (order !== 0) return order;
    return a.label.localeCompare(b.label, "es");
  });
}

export function filterDailyMatchCards(
  cards: DailyMatchCard[],
  {
    categoryId,
    instanceKeys,
  }: {
    categoryId: string;
    instanceKeys: string[];
  },
): DailyMatchCard[] {
  return cards.filter((card) => {
    if (categoryId !== DAILY_FILTER_ALL && card.categoryId !== categoryId) {
      return false;
    }
    if (
      !isAllDailyInstances(instanceKeys) &&
      !instanceKeys.includes(card.instanceKey)
    ) {
      return false;
    }
    return true;
  });
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
    (row): DailyMatchCard => {
      const groupLabel = row.zoneLetter ? `Zona ${row.zoneLetter}` : "Zona";
      const instance = instanceOf("zonas", groupLabel);
      return {
        id: `zonas-${row.id}`,
        playDate: row.playDate,
        startTime: row.startTime,
        courtIndex: row.courtIndex,
        categoryId: row.categoryId,
        categoryLabel: categoryWrittenName(
          row.categoryId,
          row.categoryLabel,
          categories,
        ),
        categoryColor: row.categoryColor,
        phase: "zonas",
        instanceKey: instance.key,
        instanceLabel: instance.label,
        groupLabel,
        matchNumber: row.matchNumber,
        pair1: row.pair1,
        pair2: row.pair2,
        observation: row.observation,
      };
    },
  );

  const intermediate = buildIntermediateMatchGridRows({
    categories,
    zoneCategories: categories,
    pairs,
    config,
  }).map((row): DailyMatchCard => {
    const instance = instanceOf("intermedia", row.roundLabel);
    return {
      id: `intermedia-${row.id}`,
      playDate: row.playDate ?? "",
      startTime: row.startTime ?? "",
      courtIndex: row.courtIndex,
      categoryId: row.categoryId,
      categoryLabel: categoryWrittenName(
        row.categoryId,
        row.categoryLabel,
        categories,
      ),
      categoryColor: row.categoryColor,
      phase: "intermedia",
      instanceKey: instance.key,
      instanceLabel: instance.label,
      groupLabel: row.roundLabel,
      matchNumber: row.officialId || row.matchNumber,
      pair1: row.pair1,
      pair2: row.pair2,
      observation: row.observation,
    };
  });

  const finals = buildFinalMatchGridRows({
    categories,
    zoneCategories: categories,
    pairs,
    config,
  }).map((row): DailyMatchCard => {
    const instance = instanceOf("final", row.roundLabel);
    return {
      id: `final-${row.id}`,
      playDate: row.playDate ?? "",
      startTime: row.startTime ?? "",
      courtIndex: row.courtIndex,
      categoryId: row.categoryId,
      categoryLabel: categoryWrittenName(
        row.categoryId,
        row.categoryLabel,
        categories,
      ),
      categoryColor: row.categoryColor,
      phase: "final",
      instanceKey: instance.key,
      instanceLabel: instance.label,
      groupLabel: row.roundLabel,
      matchNumber: row.officialId || row.matchNumber,
      pair1: row.pair1,
      pair2: row.pair2,
      observation: row.observation,
    };
  });

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
