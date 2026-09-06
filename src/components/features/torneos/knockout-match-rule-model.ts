import {
  buildMatchesRuleGrid,
  simulationRoundsFromCategory,
  slotMinutesForSimulationDate,
} from "@/modules/tournaments/domain/court-day-slots";
import { slotMinutesForOfficialLabel } from "@/modules/tournaments/domain/instance-slot-config";
import { simulationPairCount } from "@/modules/tournaments/domain/category-simulation-schema";
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
  durationForRound: (roundLabel: string) => number,
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
          durationMinutes: durationForRound(round.label),
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
  const playDates = new Set<string>();
  const fallbackDay =
    params.phase === "intermediate"
      ? penultimatePlayDay(params.config.playDays)?.date
      : lastPlayDay(params.config.playDays)?.date;
  const loads = params.config.categories.map((categoryConfig) => {
    const zonesPlayDates = [
      ...categoryConfig.phases.zones.playDates,
      ...(categoryConfig.zonesFixture?.zones ?? []).flatMap((zone) =>
        zone.matches.map((match) => match.playDate ?? ""),
      ),
    ].filter(Boolean);
    const knockoutPlayDates = [
      ...categoryConfig.phases.knockout.playDates,
      ...(categoryConfig.intermediateFixture?.rounds ?? []).flatMap((round) =>
        round.matches.map((match) => match.playDate ?? ""),
      ),
    ].filter(Boolean);
    const liveFinal = fixtureOf(
      categoryConfig,
      "final",
      params.phase === "final" ? params.liveFixtureByCategory : undefined,
    );
    const liveIntermediate = fixtureOf(
      categoryConfig,
      "intermediate",
      params.phase === "intermediate"
        ? params.liveFixtureByCategory
        : undefined,
    );
    const finalPlayDates = [
      ...categoryConfig.phases.final.playDates,
      ...(liveFinal?.rounds ?? []).flatMap((round) =>
        round.matches.map((match) => match.playDate ?? ""),
      ),
    ].filter(Boolean);
    const intermediateDates = [
      ...knockoutPlayDates,
      ...(liveIntermediate?.rounds ?? []).flatMap((round) =>
        round.matches.map((match) => match.playDate ?? ""),
      ),
    ].filter(Boolean);
    const category = params.categories.find(
      (item) => item.id === categoryConfig.categoryId,
    );
    const pairs = category ? simulationPairCount(category) : 8;
    return {
      categoryId: categoryConfig.categoryId,
      zonesPlayDates,
      knockoutPlayDates: intermediateDates,
      finalPlayDates,
      zonesSlotMinutes:
        categoryConfig.phases.zones.matchDurationMin +
        categoryConfig.intervalMin,
      knockoutSlotMinutes:
        categoryConfig.phases.knockout.matchDurationMin +
        categoryConfig.intervalMin,
      finalSlotMinutes:
        categoryConfig.phases.final.matchDurationMin +
        categoryConfig.intervalMin,
      ...simulationRoundsFromCategory(categoryConfig, pairs),
    };
  });

  let defaultSlotMinutes = 0;
  for (const load of loads) {
    const minutes =
      params.phase === "intermediate"
        ? load.knockoutSlotMinutes
        : load.finalSlotMinutes;
    defaultSlotMinutes = Math.max(defaultSlotMinutes, minutes);
    const dates =
      params.phase === "intermediate"
        ? load.knockoutPlayDates
        : load.finalPlayDates;
    for (const date of dates) playDates.add(date);
  }
  if (defaultSlotMinutes <= 0) defaultSlotMinutes = 60;
  if (fallbackDay) playDates.add(fallbackDay);

  const slotMinutesByDate: Record<string, number> = {};
  for (const date of playDates) {
    slotMinutesByDate[date] = slotMinutesForSimulationDate(
      date,
      loads,
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
        (label) =>
          slotMinutesForOfficialLabel(
            categoryConfig,
            label,
            params.phase === "intermediate" ? "knockout" : "final",
          ),
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
      (label) =>
        slotMinutesForOfficialLabel(
          categoryConfig,
          label,
          otherPhase === "intermediate" ? "knockout" : "final",
        ),
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
              durationMinutes:
                categoryConfig.phases.zones.matchDurationMin +
                categoryConfig.intervalMin,
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
