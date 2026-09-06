import { CALENDAR_PALETTE } from "@/modules/herramientas/domain/calendario-torneos";
import { comparePlayDaySchedule } from "@/modules/tournaments/domain/play-day";
import {
  buildFinalOfficialRounds,
  eligiblePairCount,
  finalPhaseSettings,
} from "@/modules/tournaments/domain/intermediate-phase";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import { categoryKnockoutNameResolver } from "./knockout-name-resolver";
import {
  buildIntermediateMatchGridRows,
  toGrillaPdfRows,
  type IntermediateMatchGridRow,
} from "./intermediate-match-grid-model";
import { buildZonesMatchGridRows } from "./zones-match-grid-model";

export type FinalMatchGridRow = IntermediateMatchGridRow;

export { toGrillaPdfRows };

function fromZoneRow(
  row: ReturnType<typeof buildZonesMatchGridRows>[number],
): FinalMatchGridRow {
  return {
    id: `zone-${row.id}`,
    playDate: row.playDate || null,
    categoryId: row.categoryId,
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

export function buildFinalMatchGridRows({
  categories,
  zoneCategories,
  pairs,
  config,
  includeZones = false,
  includeIntermediate = false,
}: {
  categories: TournamentCategoryItem[];
  zoneCategories?: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig | null;
  includeZones?: boolean;
  includeIntermediate?: boolean;
}): FinalMatchGridRow[] {
  const rows: FinalMatchGridRow[] = [];

  categories.forEach((category, categoryIndex) => {
    const settings = finalPhaseSettings(config, category.id);
    const rounds = buildFinalOfficialRounds(
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
    )?.finalFixture;
    const scheduleByOfficialId = new Map(
      (fixture?.rounds ?? []).flatMap((round) =>
        round.matches.map((match) => [match.officialId, match] as const),
      ),
    );
    const resolveLabel = categoryKnockoutNameResolver({
      config,
      categoryId: category.id,
      pairs,
      matchFormat: settings.matchFormat,
    });

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
          categoryId: category.id,
          categoryLabel,
          categoryColor,
          roundLabel: round.label,
          matchNumber: index + 1,
          officialId: crossing.id,
          pair1: resolveLabel(crossing.left),
          pair2: resolveLabel(crossing.right),
          startTime: scheduled?.startTime ?? null,
          courtIndex: scheduled?.courtIndex ?? null,
          observation: notes.join(" · "),
        });
      });
    }
  });

  const previous: FinalMatchGridRow[] = [];
  if (includeZones) {
    previous.push(
      ...buildZonesMatchGridRows({
        categories: zoneCategories ?? categories,
        pairs,
        config,
      }).map(fromZoneRow),
    );
  }
  if (includeIntermediate) {
    previous.push(
      ...buildIntermediateMatchGridRows({
        categories: zoneCategories ?? categories,
        zoneCategories,
        pairs,
        config,
      }),
    );
  }

  const dayOpenByDate: Record<string, string> = {};
  for (const day of config?.playDays ?? []) {
    if (day.date) dayOpenByDate[day.date] = day.startTime;
  }

  return [...previous, ...rows].sort((a, b) => {
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
