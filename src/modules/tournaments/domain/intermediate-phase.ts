import {
  FINAL_PHASE_START_ROUND_LABELS,
  type BracketRound,
  type FinalPhaseStartRound,
  type MatchFormat,
} from "./config-schema";
import { defaultPhaseConfigs } from "./config-defaults";
import { flattenApaRounds, parseApaLlave } from "./apa-llaves";
import {
  flattenFapRounds,
  parseFapLlave,
  type FapCrossing,
  type FapNode,
} from "./fap-llaves";
import type {
  PairListItem,
  TournamentCategoryItem,
  TournamentConfig,
} from "./types";

export const OFFICIAL_ROUND_ORDER = [
  "32 avos",
  "16 avos",
  "Octavos",
  "Cuartos",
  "Semifinal",
  "Final",
] as const;

export type OfficialRound = {
  label: string;
  crossings: FapCrossing[];
};

export const OFFICIAL_LABEL_TO_BRACKET_ROUND: Record<string, BracketRound> = {
  "32 avos": "ROUND_64",
  "16 avos": "ROUND_32",
  Octavos: "ROUND_16",
  Cuartos: "QUARTER_FINALS",
  Semifinal: "SEMI_FINALS",
  Final: "FINAL",
};

export type OfficialPhaseInstances = {
  knockout: OfficialRound[];
  final: OfficialRound[];
  knockoutKeys: BracketRound[];
  finalKeys: BracketRound[];
  knockoutMatches: number;
  finalMatches: number;
};

function officialKeys(rounds: OfficialRound[]): BracketRound[] {
  return rounds
    .map((round) => OFFICIAL_LABEL_TO_BRACKET_ROUND[round.label])
    .filter((key): key is BracketRound => Boolean(key));
}

function officialMatchCount(rounds: OfficialRound[]): number {
  return rounds.reduce((sum, round) => sum + round.crossings.length, 0);
}

export function officialPhaseInstances(params: {
  pairCount: number;
  zone4Advancers: 2 | 3;
  startsAt: FinalPhaseStartRound;
}): OfficialPhaseInstances {
  const split = splitOfficialRounds(
    officialLlaveRounds(params.pairCount, params.zone4Advancers),
    params.startsAt,
  );
  return {
    knockout: split.intermediate,
    final: split.final,
    knockoutKeys: officialKeys(split.intermediate),
    finalKeys: officialKeys(split.final),
    knockoutMatches: officialMatchCount(split.intermediate),
    finalMatches: officialMatchCount(split.final),
  };
}

export type IntermediatePhaseSettings = {
  zone4Advancers: 2 | 3;
  startsAtRound: FinalPhaseStartRound;
  matchFormat: MatchFormat;
};

export function splitOfficialRounds(
  rounds: OfficialRound[],
  startsAt: FinalPhaseStartRound,
): { intermediate: OfficialRound[]; final: OfficialRound[] } {
  const cutLabel = FINAL_PHASE_START_ROUND_LABELS[startsAt];
  const cutIdx = OFFICIAL_ROUND_ORDER.indexOf(
    cutLabel as (typeof OFFICIAL_ROUND_ORDER)[number],
  );
  const intermediate: OfficialRound[] = [];
  const final: OfficialRound[] = [];

  for (const round of rounds) {
    const idx = OFFICIAL_ROUND_ORDER.indexOf(
      round.label as (typeof OFFICIAL_ROUND_ORDER)[number],
    );
    if (idx >= 0 && cutIdx >= 0 && idx < cutIdx) {
      intermediate.push(round);
    } else {
      final.push(round);
    }
  }

  return { intermediate, final };
}

export function officialRoundPhase(
  label: string,
  startsAt: FinalPhaseStartRound,
): "intermediate" | "final" {
  const cutLabel = FINAL_PHASE_START_ROUND_LABELS[startsAt];
  const cutIdx = OFFICIAL_ROUND_ORDER.indexOf(
    cutLabel as (typeof OFFICIAL_ROUND_ORDER)[number],
  );
  const idx = OFFICIAL_ROUND_ORDER.indexOf(
    label as (typeof OFFICIAL_ROUND_ORDER)[number],
  );
  if (idx >= 0 && cutIdx >= 0 && idx < cutIdx) return "intermediate";
  return "final";
}

export function eligiblePairCount(
  pairs: PairListItem[],
  categoryId: string,
): number {
  return pairs.filter(
    (pair) =>
      pair.categoryId === categoryId &&
      pair.status !== "CANCELLED" &&
      pair.player2,
  ).length;
}

export function officialLlaveTree(
  pairCount: number,
  zone4Advancers: 2 | 3,
): FapNode | null {
  return zone4Advancers === 3
    ? parseFapLlave(pairCount)
    : parseApaLlave(pairCount);
}

export function officialLlaveRounds(
  pairCount: number,
  zone4Advancers: 2 | 3,
): OfficialRound[] {
  const tree = officialLlaveTree(pairCount, zone4Advancers);
  if (!tree) return [];
  return zone4Advancers === 3
    ? flattenFapRounds(tree)
    : flattenApaRounds(tree);
}

export function buildIntermediateOfficialRounds(
  pairCount: number,
  zone4Advancers: 2 | 3,
  startsAt: FinalPhaseStartRound,
): OfficialRound[] {
  return splitOfficialRounds(
    officialLlaveRounds(pairCount, zone4Advancers),
    startsAt,
  ).intermediate;
}

export function buildFinalOfficialRounds(
  pairCount: number,
  zone4Advancers: 2 | 3,
  startsAt: FinalPhaseStartRound,
): OfficialRound[] {
  return splitOfficialRounds(
    officialLlaveRounds(pairCount, zone4Advancers),
    startsAt,
  ).final;
}

export function categoryHasIntermediatePhase(params: {
  pairCount: number;
  zone4Advancers: 2 | 3;
  startsAtRound: FinalPhaseStartRound;
}): boolean {
  return (
    buildIntermediateOfficialRounds(
      params.pairCount,
      params.zone4Advancers,
      params.startsAtRound,
    ).length > 0
  );
}

export function intermediatePhaseSettings(
  config: TournamentConfig | null,
  categoryId: string,
): IntermediatePhaseSettings {
  const category = config?.categories.find(
    (item) => item.categoryId === categoryId,
  );
  const defaults = defaultPhaseConfigs();
  return {
    zone4Advancers: category?.zone4Advancers === 2 ? 2 : 3,
    startsAtRound:
      category?.phases.final.startsAtRound ?? defaults.final.startsAtRound,
    matchFormat:
      category?.phases.knockout.matchFormat ?? defaults.knockout.matchFormat,
  };
}

export function categoriesWithIntermediatePhase(
  categories: TournamentCategoryItem[],
  pairs: PairListItem[],
  config: TournamentConfig | null,
): TournamentCategoryItem[] {
  return categories.filter((category) => {
    const settings = intermediatePhaseSettings(config, category.id);
    return categoryHasIntermediatePhase({
      pairCount: eligiblePairCount(pairs, category.id),
      zone4Advancers: settings.zone4Advancers,
      startsAtRound: settings.startsAtRound,
    });
  });
}

export type FinalPhaseSettings = IntermediatePhaseSettings;

export function categoryHasFinalPhase(params: {
  pairCount: number;
  zone4Advancers: 2 | 3;
  startsAtRound: FinalPhaseStartRound;
}): boolean {
  return (
    buildFinalOfficialRounds(
      params.pairCount,
      params.zone4Advancers,
      params.startsAtRound,
    ).length > 0
  );
}

export function finalPhaseSettings(
  config: TournamentConfig | null,
  categoryId: string,
): FinalPhaseSettings {
  const category = config?.categories.find(
    (item) => item.categoryId === categoryId,
  );
  const defaults = defaultPhaseConfigs();
  return {
    zone4Advancers: category?.zone4Advancers === 2 ? 2 : 3,
    startsAtRound:
      category?.phases.final.startsAtRound ?? defaults.final.startsAtRound,
    matchFormat:
      category?.phases.final.matchFormat ?? defaults.final.matchFormat,
  };
}

export function categoriesWithFinalPhase(
  categories: TournamentCategoryItem[],
  pairs: PairListItem[],
  config: TournamentConfig | null,
): TournamentCategoryItem[] {
  return categories.filter((category) => {
    const settings = finalPhaseSettings(config, category.id);
    return categoryHasFinalPhase({
      pairCount: eligiblePairCount(pairs, category.id),
      zone4Advancers: settings.zone4Advancers,
      startsAtRound: settings.startsAtRound,
    });
  });
}
