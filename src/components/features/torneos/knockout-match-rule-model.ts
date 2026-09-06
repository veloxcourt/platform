import { buildMatchesRuleGrid } from "@/modules/tournaments/domain/court-day-slots";
import type {
  CourtDayRule,
  ScheduledMatchMark,
  SimulationPhaseKey,
} from "@/modules/tournaments/domain/court-day-slots";
import {
  lastPlayDay,
  penultimatePlayDay,
} from "@/modules/tournaments/domain/build-intermediate-fixture";
import type { IntermediateFixturePersisted } from "@/modules/tournaments/domain/intermediate-fixture-schema";
import type {
  TournamentCategoryItem,
  TournamentConfig,
} from "@/modules/tournaments/domain/types";
import {
  formatZoneMatchCode,
  formatZoneMatchSlotCode,
} from "@/modules/tournaments/domain/zone-bracket";

export function knockoutShortRoundCode(
  roundLabel: string,
  matchNumber: number,
): string {
  const key = roundLabel.toLowerCase();
  if (key.includes("32")) return `32-${matchNumber}`;
  if (key.includes("16")) return `16-${matchNumber}`;
  if (key.startsWith("oct")) return `O${matchNumber}`;
  if (key.startsWith("cua")) return `C${matchNumber}`;
  if (key.startsWith("semi")) return `S${matchNumber}`;
  if (key.startsWith("fin")) return `F${matchNumber}`;
  return `${matchNumber}`;
}

function fixtureOf(
  categoryConfig: TournamentConfig["categories"][number],
  phase: "intermediate" | "final",
  liveFixtureByCategory?: Record<
    string,
    IntermediateFixturePersisted | null | undefined
  >,
): IntermediateFixturePersisted | null {
  const live = liveFixtureByCategory?.[categoryConfig.categoryId];
  if (live !== undefined) return live;
  return phase === "intermediate"
    ? categoryConfig.intermediateFixture
    : categoryConfig.finalFixture;
}

function knockoutMarks(
  fixture: IntermediateFixturePersisted | null,
  categoryId: string,
  abbreviation: string | null | undefined,
  projectedPhase: SimulationPhaseKey,
  excludeOfficialId?: number | null,
): ScheduledMatchMark[] {
  if (!fixture) return [];
  const abbr = abbreviation?.trim() || "?";
  return fixture.rounds.flatMap((round) =>
    round.matches
      .filter((match) => match.officialId !== excludeOfficialId)
      .map((match) => {
        const code = knockoutShortRoundCode(round.label, match.matchIndex + 1);
        return {
          categoryId,
          playDate: match.playDate ?? "",
          startTime: match.startTime ?? "",
          courtIndex: match.courtIndex,
          slotIndex: match.slotIndex,
          matchCode: code,
          pairLabel: `${abbr}-${code}`,
          pair1Label: match.left,
          pair2Label: match.right,
          projectedPhase,
        };
      }),
  );
}

export function buildKnockoutSlotRules(params: {
  phase: "intermediate" | "final";
  categories: TournamentCategoryItem[];
  config: TournamentConfig;
  courtCount: number;
  liveFixtureByCategory?: Record<
    string,
    IntermediateFixturePersisted | null | undefined
  >;
  exclude?: { categoryId: string; officialId: number } | null;
  includeZones?: boolean;
}): CourtDayRule[] {
  const abbreviationById = new Map(
    params.categories.map((category) => [category.id, category.abbreviation]),
  );
  const slotMinutesByDate: Record<string, number> = {};
  let defaultSlotMinutes = 60;
  const playDates = new Set<string>();
  const fallbackDay =
    params.phase === "intermediate"
      ? penultimatePlayDay(params.config.playDays)?.date
      : lastPlayDay(params.config.playDays)?.date;

  for (const categoryConfig of params.config.categories) {
    const phaseConfig =
      params.phase === "intermediate"
        ? categoryConfig.phases.knockout
        : categoryConfig.phases.final;
    const minutes = phaseConfig.matchDurationMin + categoryConfig.intervalMin;
    defaultSlotMinutes = Math.max(defaultSlotMinutes, minutes);

    for (const date of phaseConfig.playDates) {
      if (!date) continue;
      playDates.add(date);
      slotMinutesByDate[date] = Math.max(slotMinutesByDate[date] ?? 0, minutes);
    }

    const fixture = fixtureOf(
      categoryConfig,
      params.phase,
      params.liveFixtureByCategory,
    );
    for (const round of fixture?.rounds ?? []) {
      for (const match of round.matches) {
        if (!match.playDate) continue;
        playDates.add(match.playDate);
        slotMinutesByDate[match.playDate] = Math.max(
          slotMinutesByDate[match.playDate] ?? 0,
          minutes,
        );
      }
    }
  }

  if (fallbackDay) {
    playDates.add(fallbackDay);
    slotMinutesByDate[fallbackDay] = Math.max(
      slotMinutesByDate[fallbackDay] ?? 0,
      defaultSlotMinutes,
    );
  }

  const phaseKey: SimulationPhaseKey =
    params.phase === "intermediate" ? "knockout" : "final";
  const otherPhase: "intermediate" | "final" =
    params.phase === "intermediate" ? "final" : "intermediate";
  const otherPhaseKey: SimulationPhaseKey =
    otherPhase === "intermediate" ? "knockout" : "final";

  const currentPhaseMatches = params.config.categories.flatMap(
    (categoryConfig) =>
      knockoutMarks(
        fixtureOf(
          categoryConfig,
          params.phase,
          params.liveFixtureByCategory,
        ),
        categoryConfig.categoryId,
        abbreviationById.get(categoryConfig.categoryId),
        phaseKey,
        params.exclude?.categoryId === categoryConfig.categoryId
          ? params.exclude.officialId
          : null,
      ),
  );

  const otherPhaseMatches = params.config.categories.flatMap((categoryConfig) =>
    knockoutMarks(
      otherPhase === "intermediate"
        ? categoryConfig.intermediateFixture
        : categoryConfig.finalFixture,
      categoryConfig.categoryId,
      abbreviationById.get(categoryConfig.categoryId),
      otherPhaseKey,
    ),
  );

  const zoneMatches =
    params.includeZones === false
      ? []
      : params.config.categories.flatMap((categoryConfig) =>
          (categoryConfig.zonesFixture?.zones ?? []).flatMap((zone) =>
            zone.matches.map((match) => ({
              categoryId: categoryConfig.categoryId,
              playDate: match.playDate ?? "",
              startTime: match.startTime ?? "",
              courtIndex: match.courtIndex,
              slotIndex: match.slotIndex,
              matchCode: formatZoneMatchSlotCode(
                zone.label,
                match.matchIndex + 1,
              ),
              pairLabel: formatZoneMatchCode(
                abbreviationById.get(categoryConfig.categoryId),
                zone.label,
                match.matchIndex + 1,
              ),
              pair1Label: match.pair1Id ?? "Pareja 1",
              pair2Label: match.pair2Id ?? "Pareja 2",
              projectedPhase: "zones" as const,
            })),
          ),
        );

  return buildMatchesRuleGrid({
    playDays: params.config.playDays,
    courtCount: params.config.courtCount || params.courtCount || 1,
    defaultSlotMinutes,
    slotMinutesByDate,
    matches: [...zoneMatches, ...otherPhaseMatches, ...currentPhaseMatches],
    zonesPlayDates: [...playDates],
  });
}
