import { formatWeekday } from "@/lib/date";
import { formatAbbreviatedPairLabel } from "@/lib/person-name";
import { CALENDAR_PALETTE } from "@/modules/herramientas/domain/calendario-torneos";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import { ZONE_RULE_BREAK_LABELS } from "@/modules/tournaments/domain/build-zones-fixture";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  ZONE_MATCH_KIND_LABELS,
  zoneLetterFromLabel,
} from "@/modules/tournaments/domain/zone-bracket";

export type ZonesMatchGridRow = {
  id: string;
  playDate: string;
  startTime: string;
  courtIndex: number | null;
  categoryLabel: string;
  categoryColor: string;
  zoneLetter: string;
  matchNumber: number;
  pair1: string;
  pair2: string;
  observation: string;
};

function pairName(pair: PairListItem | undefined): string {
  if (!pair) return "—";
  return formatAbbreviatedPairLabel(
    pair.player1.name,
    pair.player2?.name ?? null,
  );
}

function observationFor(match: {
  noRestGap?: boolean;
  ruleBreaks?: Array<keyof typeof ZONE_RULE_BREAK_LABELS>;
  kind?: string;
  pair1Id: string | null;
  pair2Id: string | null;
  playDate: string | null;
  startTime: string | null;
  courtIndex: number | null;
}): string {
  const notes: string[] = [];
  if (!match.playDate?.trim() || !match.startTime?.trim()) {
    notes.push("Sin horario");
  }
  if (match.courtIndex == null) notes.push("Sin cancha");
  if (match.noRestGap) notes.push("Sin descanso");
  for (const breakKey of match.ruleBreaks ?? []) {
    if (breakKey === "rest") continue;
    notes.push(ZONE_RULE_BREAK_LABELS[breakKey]);
  }
  if (
    (match.kind === "winners" || match.kind === "losers") &&
    (!match.pair1Id || !match.pair2Id)
  ) {
    notes.push(ZONE_MATCH_KIND_LABELS[match.kind] ?? "Parejas a definir");
  }
  return notes.join(" · ");
}

export function formatGridHorario(row: Pick<ZonesMatchGridRow, "playDate" | "startTime">) {
  if (row.playDate && row.startTime) {
    return `${formatWeekday(row.playDate)} · ${row.startTime}`;
  }
  return row.startTime || "—";
}

export function formatGridCourt(row: Pick<ZonesMatchGridRow, "courtIndex">) {
  return row.courtIndex == null ? "—" : String(row.courtIndex + 1);
}

export function buildZonesMatchGridRows({
  categories,
  pairs,
  config,
}: {
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
}): ZonesMatchGridRow[] {
  if (!config) return [];

  const dayOpenByDate: Record<string, string> = {};
  for (const day of config.playDays) {
    if (day.date) dayOpenByDate[day.date] = day.startTime;
  }

  const pairById = new Map(pairs.map((pair) => [pair.id, pair]));
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const collected: ZonesMatchGridRow[] = [];

  config.categories.forEach((categoryConfig, categoryIndex) => {
    const category = categoryById.get(categoryConfig.categoryId);
    const categoryLabel =
      category?.abbreviation ||
      category?.name ||
      categoryConfig.categoryName;
    const categoryColor =
      category?.color ??
      CALENDAR_PALETTE[categoryIndex % CALENDAR_PALETTE.length]!;
    for (const zone of categoryConfig.zonesFixture?.zones ?? []) {
      zone.matches.forEach((match, index) => {
        collected.push({
          id: `${categoryConfig.categoryId}-${zone.label}-${match.matchIndex}-${index}`,
          playDate: match.playDate ?? "",
          startTime: match.startTime ?? "",
          courtIndex: match.courtIndex,
          categoryLabel,
          categoryColor,
          zoneLetter: zoneLetterFromLabel(zone.label),
          matchNumber: match.matchIndex + 1,
          pair1: pairName(
            match.pair1Id ? pairById.get(match.pair1Id) : undefined,
          ),
          pair2: pairName(
            match.pair2Id ? pairById.get(match.pair2Id) : undefined,
          ),
          observation: observationFor(match),
        });
      });
    }
  });

  return collected.sort((a, b) => {
    const schedule = comparePlayDaySchedule(a, b, dayOpenByDate);
    if (schedule !== 0) return schedule;
    const courtA = a.courtIndex ?? Number.MAX_SAFE_INTEGER;
    const courtB = b.courtIndex ?? Number.MAX_SAFE_INTEGER;
    if (courtA !== courtB) return courtA - courtB;
    return a.categoryLabel.localeCompare(b.categoryLabel, "es");
  });
}
