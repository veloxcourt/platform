import { CALENDAR_PALETTE } from "@/modules/herramientas/domain/calendario-torneos";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import {
  buildIntermediateOfficialRounds,
  eligiblePairCount,
  intermediatePhaseSettings,
} from "@/modules/tournaments/domain/intermediate-phase";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  buildZonesMatchGridRows,
  type ZonesMatchGridRow,
} from "./zones-match-grid-model";

export type IntermediateMatchGridRow = {
  id: string;
  playDate: string | null;
  categoryLabel: string;
  categoryColor: string;
  roundLabel: string;
  matchNumber: number;
  officialId: number;
  pair1: string;
  pair2: string;
  startTime: string | null;
  courtIndex: number | null;
  observation: string;
};

export function toGrillaPdfRows(
  rows: IntermediateMatchGridRow[],
): ZonesMatchGridRow[] {
  return rows.map((row) => ({
    id: row.id,
    playDate: row.playDate ?? "",
    startTime: row.startTime ?? "",
    courtIndex: row.courtIndex,
    categoryLabel: row.categoryLabel,
    categoryColor: row.categoryColor,
    zoneLetter: row.roundLabel,
    matchNumber: row.matchNumber,
    pair1: row.pair1,
    pair2: row.pair2,
    observation: row.observation,
  }));
}

function fromZoneRow(row: ZonesMatchGridRow): IntermediateMatchGridRow {
  return {
    id: `zone-${row.id}`,
    playDate: row.playDate || null,
    categoryLabel: row.categoryLabel,
    categoryColor: row.categoryColor,
    roundLabel: row.zoneLetter,
    matchNumber: row.matchNumber,
    officialId: 0,
    pair1: row.pair1,
    pair2: row.pair2,
    startTime: row.startTime || null,
    courtIndex: row.courtIndex,
    observation: row.observation,
  };
}

export function buildIntermediateMatchGridRows({
  categories,
  zoneCategories,
  pairs,
  config,
  includeZones = false,
}: {
  categories: TournamentCategoryItem[];
  zoneCategories?: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  includeZones?: boolean;
}): IntermediateMatchGridRow[] {
  const rows: IntermediateMatchGridRow[] = [];

  categories.forEach((category, categoryIndex) => {
    const settings = intermediatePhaseSettings(config, category.id);
    const rounds = buildIntermediateOfficialRounds(
      eligiblePairCount(pairs, category.id),
      settings.zone4Advancers,
      settings.startsAtRound,
    );
    const categoryLabel = category.abbreviation || category.name;
    const categoryColor =
      category.color ??
      CALENDAR_PALETTE[categoryIndex % CALENDAR_PALETTE.length]!;
    const fixture = config?.categories.find(
      (item) => item.categoryId === category.id,
    )?.intermediateFixture;
    const scheduleByOfficialId = new Map(
      (fixture?.rounds ?? []).flatMap((round) =>
        round.matches.map((match) => [match.officialId, match] as const),
      ),
    );

    for (const round of rounds) {
      round.crossings.forEach((crossing, index) => {
        const scheduled = scheduleByOfficialId.get(crossing.id);
        const notes: string[] = [];
        if (!scheduled?.playDate || !scheduled.startTime) {
          notes.push("Sin horario");
        }
        if (scheduled && scheduled.courtIndex == null) notes.push("Sin cancha");
        if (scheduled?.noRestGap) notes.push("Sin descanso");
        rows.push({
          id: `${category.id}-${round.label}-${crossing.id}-${index}`,
          playDate: scheduled?.playDate ?? null,
          categoryLabel,
          categoryColor,
          roundLabel: round.label,
          matchNumber: index + 1,
          officialId: crossing.id,
          pair1: crossing.left,
          pair2: crossing.right,
          startTime: scheduled?.startTime ?? null,
          courtIndex: scheduled?.courtIndex ?? null,
          observation: notes.join(" · "),
        });
      });
    }
  });

  if (!includeZones) return rows;

  const zoneRows = buildZonesMatchGridRows({
    categories: zoneCategories ?? categories,
    pairs,
    config,
  }).map(fromZoneRow);

  const dayOpenByDate: Record<string, string> = {};
  for (const day of config?.playDays ?? []) {
    if (day.date) dayOpenByDate[day.date] = day.startTime;
  }

  return [...zoneRows, ...rows].sort((a, b) => {
    const schedule = comparePlayDaySchedule(
      { playDate: a.playDate, startTime: a.startTime },
      { playDate: b.playDate, startTime: b.startTime },
      dayOpenByDate,
    );
    if (schedule !== 0) return schedule;
    const courtA = a.courtIndex ?? Number.MAX_SAFE_INTEGER;
    const courtB = b.courtIndex ?? Number.MAX_SAFE_INTEGER;
    if (courtA !== courtB) return courtA - courtB;
    return a.categoryLabel.localeCompare(b.categoryLabel, "es");
  });
}
