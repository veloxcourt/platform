import { z } from "zod";

import {
  finalRoundKeys,
  intermediateRounds,
} from "./bracket-rounds";
import {
  BRACKET_ROUND_VALUES,
  MATCH_FORMAT_VALUES,
  type BracketRound,
  type FinalPhaseStartRound,
  type PhaseConfigValues,
  type RoundConfigMapValues,
} from "./config-schema";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const storedPhaseConfigSchema = z.object({
  matchFormat: z.enum(MATCH_FORMAT_VALUES),
  matchDurationMin: z.number().int().min(30).max(180),
  playDates: z.array(z.string().regex(DATE_REGEX)),
});

const storedRoundConfigMapSchema = z.object({
  ROUND_64: storedPhaseConfigSchema.optional(),
  ROUND_32: storedPhaseConfigSchema.optional(),
  ROUND_16: storedPhaseConfigSchema.optional(),
  QUARTER_FINALS: storedPhaseConfigSchema.optional(),
  SEMI_FINALS: storedPhaseConfigSchema.optional(),
  FINAL: storedPhaseConfigSchema.optional(),
});

export function clonePhaseConfig(
  config: PhaseConfigValues,
): PhaseConfigValues {
  return {
    matchFormat: config.matchFormat,
    matchDurationMin: config.matchDurationMin,
    playDates: [...config.playDates],
  };
}

export function parseStoredRoundConfigs(
  value: unknown,
): Partial<RoundConfigMapValues> {
  const parsed = storedRoundConfigMapSchema.safeParse(value);
  if (!parsed.success) return {};
  return parsed.data;
}

export function seedRoundConfigs(
  fallbackKnockout: PhaseConfigValues,
  fallbackFinal: PhaseConfigValues,
  startsAt: FinalPhaseStartRound,
  existing?: Partial<RoundConfigMapValues>,
): RoundConfigMapValues {
  const finalKeys = new Set(finalRoundKeys(startsAt));
  return Object.fromEntries(
    BRACKET_ROUND_VALUES.map((key) => {
      const fallback = finalKeys.has(key) ? fallbackFinal : fallbackKnockout;
      return [key, clonePhaseConfig(existing?.[key] ?? fallback)];
    }),
  ) as RoundConfigMapValues;
}

export function aggregateRoundConfigs(
  rounds: Partial<RoundConfigMapValues>,
  keys: BracketRound[],
  fallback: PhaseConfigValues,
): PhaseConfigValues {
  const first = keys.map((key) => rounds[key]).find(Boolean);
  const playDates = [
    ...new Set(keys.flatMap((key) => rounds[key]?.playDates ?? [])),
  ];
  return {
    matchFormat: first?.matchFormat ?? fallback.matchFormat,
    matchDurationMin: first?.matchDurationMin ?? fallback.matchDurationMin,
    playDates,
  };
}

export function materializeCategoryRounds(input: {
  startsAt: FinalPhaseStartRound;
  rounds?: Partial<RoundConfigMapValues>;
  knockout: PhaseConfigValues;
  final: PhaseConfigValues;
  zones: PhaseConfigValues;
  validDates?: Set<string>;
  knockoutKeys?: BracketRound[];
  finalKeys?: BracketRound[];
}): {
  rounds: RoundConfigMapValues;
  knockout: PhaseConfigValues;
  final: PhaseConfigValues;
  zones: PhaseConfigValues;
} {
  const filterDates = (dates: string[]) =>
    input.validDates
      ? dates.filter((date) => input.validDates?.has(date))
      : dates;

  const seeded = seedRoundConfigs(
    input.knockout,
    input.final,
    input.startsAt,
    input.rounds,
  );
  const rounds = Object.fromEntries(
    BRACKET_ROUND_VALUES.map((key) => [
      key,
      {
        ...seeded[key],
        playDates: filterDates(seeded[key].playDates),
      },
    ]),
  ) as RoundConfigMapValues;

  return {
    rounds,
    zones: {
      ...input.zones,
      playDates: filterDates(input.zones.playDates),
    },
    knockout: aggregateRoundConfigs(
      rounds,
      input.knockoutKeys ?? intermediateRounds(input.startsAt),
      input.knockout,
    ),
    final: aggregateRoundConfigs(
      rounds,
      input.finalKeys ?? finalRoundKeys(input.startsAt),
      input.final,
    ),
  };
}
