import { CALENDAR_PALETTE } from "@/modules/herramientas/domain/calendario-torneos";
import { buildMatchesRuleGrid } from "@/modules/tournaments/domain/court-day-slots";
import type { CourtDayRule } from "@/modules/tournaments/domain/court-day-slots";
import { formatAbbreviatedPairLabel } from "@/lib/person-name";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  formatZoneMatchCode,
  formatZoneMatchSlotCode,
  type ZoneMatchKind,
} from "@/modules/tournaments/domain/zone-bracket";
import type { SlotRuleGridCategory } from "./slot-rule-grid";

export function zoneRuleCategoryColor(
  category: TournamentCategoryItem,
  index: number,
): string {
  return category.color ?? CALENDAR_PALETTE[index % CALENDAR_PALETTE.length]!;
}

export function zoneRuleGridCategories(
  categories: TournamentCategoryItem[],
): SlotRuleGridCategory[] {
  return categories.map((category, index) => ({
    id: category.id,
    name: category.name,
    abbreviation: category.abbreviation,
    color: zoneRuleCategoryColor(category, index),
  }));
}

function pairSideLabel(
  pairId: string | null | undefined,
  pairById: Map<string, PairListItem>,
  kind: ZoneMatchKind | undefined,
  side: 1 | 2,
): string {
  if (pairId) {
    const pair = pairById.get(pairId);
    if (pair) {
      return formatAbbreviatedPairLabel(
        pair.player1.name,
        pair.player2?.name ?? null,
      );
    }
  }
  if (kind === "winners") return "Ganador";
  if (kind === "losers") return "Perdedor";
  return side === 1 ? "Pareja 1" : "Pareja 2";
}

export type LiveZoneRuleSource = {
  label: string;
  matches: Array<{
    id?: string;
    matchIndex?: number;
    playDate?: string | null;
    startTime?: string | null;
    courtIndex?: number | null;
    kind?: ZoneMatchKind | null;
    pair1Id?: string | null;
    pair2Id?: string | null;
  }>;
};

export function buildZonesSlotRules(params: {
  categories: TournamentCategoryItem[];
  pairs: PairListItem[];
  config: TournamentConfig;
  courtCount: number;
  selectedCategoryIds?: string[];
  liveZonesByCategory?: Record<string, LiveZoneRuleSource[]>;
  excludeMatchId?: string | null;
}): CourtDayRule[] {
  const selected = new Set(
    params.selectedCategoryIds ?? params.categories.map((category) => category.id),
  );
  const abbreviationById = new Map(
    params.categories.map((category) => [category.id, category.abbreviation]),
  );
  const pairById = new Map(params.pairs.map((pair) => [pair.id, pair]));

  const slotMinutesByDate: Record<string, number> = {};
  let defaultSlotMinutes = 60;
  for (const categoryConfig of params.config.categories) {
    const minutes =
      categoryConfig.phases.zones.matchDurationMin +
      categoryConfig.intervalMin;
    defaultSlotMinutes = Math.max(defaultSlotMinutes, minutes);
    for (const date of categoryConfig.phases.zones.playDates) {
      if (!date) continue;
      slotMinutesByDate[date] = Math.max(slotMinutesByDate[date] ?? 0, minutes);
    }
  }

  const zonesPlayDates = [
    ...new Set(
      params.config.categories
        .filter((categoryConfig) => selected.has(categoryConfig.categoryId))
        .flatMap((categoryConfig) =>
          categoryConfig.phases.zones.playDates.filter(Boolean),
        ),
    ),
  ];

  const matches = params.config.categories.flatMap((categoryConfig) => {
    if (!selected.has(categoryConfig.categoryId)) return [];
    const live = params.liveZonesByCategory?.[categoryConfig.categoryId];
    const zones = live ?? categoryConfig.zonesFixture?.zones ?? [];
    return zones.flatMap((zone) =>
      zone.matches
        .filter((match) => {
          if (!params.excludeMatchId) return true;
          return !("id" in match && match.id === params.excludeMatchId);
        })
        .map((match, index) => ({
          categoryId: categoryConfig.categoryId,
          playDate: match.playDate ?? "",
          startTime: match.startTime ?? "",
          courtIndex: match.courtIndex ?? null,
          matchCode: formatZoneMatchSlotCode(
            zone.label,
            (match.matchIndex ?? index) + 1,
          ),
          pairLabel: formatZoneMatchCode(
            abbreviationById.get(categoryConfig.categoryId),
            zone.label,
            (match.matchIndex ?? index) + 1,
          ),
          pair1Label: pairSideLabel(
            match.pair1Id,
            pairById,
            match.kind ?? undefined,
            1,
          ),
          pair2Label: pairSideLabel(
            match.pair2Id,
            pairById,
            match.kind ?? undefined,
            2,
          ),
        })),
    );
  });

  return buildMatchesRuleGrid({
    playDays: params.config.playDays,
    courtCount: params.config.courtCount || params.courtCount || 1,
    defaultSlotMinutes,
    slotMinutesByDate,
    matches,
    zonesPlayDates,
  });
}
