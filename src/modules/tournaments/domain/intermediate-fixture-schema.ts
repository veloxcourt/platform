import { z } from "zod";
import type { IntermediateFixtureCategoryResult } from "./build-intermediate-fixture";

export const intermediateFixtureMatchSchema = z.object({
  officialId: z.number().int(),
  roundLabel: z.string().min(1),
  matchIndex: z.number().int().min(0),
  left: z.string(),
  right: z.string(),
  playDate: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable().optional(),
  courtIndex: z.number().int().min(0).nullable(),
  slotIndex: z.number().int().min(0).nullable().optional(),
  noRestGap: z.boolean().optional(),
});

export const intermediateFixtureSchema = z.object({
  rounds: z.array(
    z.object({
      label: z.string().min(1),
      matches: z.array(intermediateFixtureMatchSchema),
    }),
  ),
  warnings: z.array(z.string()).default([]),
  builtAt: z.string(),
});

export type IntermediateFixturePersisted = z.infer<
  typeof intermediateFixtureSchema
>;

export function parseIntermediateFixture(
  value: unknown,
): IntermediateFixturePersisted | null {
  const parsed = intermediateFixtureSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toPersistedIntermediateFixture(
  result: IntermediateFixtureCategoryResult,
): IntermediateFixturePersisted {
  return {
    rounds: result.rounds,
    warnings: result.warnings,
    builtAt: result.builtAt,
  };
}

export const parseFinalFixture = parseIntermediateFixture;
export const toPersistedFinalFixture = toPersistedIntermediateFixture;
export type FinalFixturePersisted = IntermediateFixturePersisted;

export type KnockoutFixturePhase = "intermediate" | "final";

export function knockoutFixtureStamps(
  fixture: IntermediateFixturePersisted | null | undefined,
): Array<{
  playDate: string | null;
  startTime: string | null;
  endTime?: string | null;
  courtIndex: number | null;
  slotIndex?: number | null;
}> {
  return (fixture?.rounds ?? []).flatMap((round) =>
    round.matches.map((match) => ({
      playDate: match.playDate,
      startTime: match.startTime,
      endTime: match.endTime,
      courtIndex: match.courtIndex,
      slotIndex: match.slotIndex,
    })),
  );
}

type ScheduleFields = Pick<
  IntermediateFixturePersisted["rounds"][number]["matches"][number],
  "playDate" | "startTime" | "endTime" | "courtIndex" | "slotIndex" | "noRestGap"
>;

function scheduleOf(
  match: IntermediateFixturePersisted["rounds"][number]["matches"][number],
): ScheduleFields {
  return {
    playDate: match.playDate,
    startTime: match.startTime,
    endTime: match.endTime,
    courtIndex: match.courtIndex,
    slotIndex: match.slotIndex,
    noRestGap: match.noRestGap,
  };
}

/// Intercambia día/horario/cancha entre dos cruces. El cruce (quién juega) no cambia.
export function swapFixtureMatchSchedules(
  fixture: IntermediateFixturePersisted,
  officialIdA: number,
  officialIdB: number,
): IntermediateFixturePersisted {
  if (officialIdA === officialIdB) return fixture;
  const matches = fixture.rounds.flatMap((round) => round.matches);
  const first = matches.find((match) => match.officialId === officialIdA);
  const second = matches.find((match) => match.officialId === officialIdB);
  if (!first || !second) return fixture;
  const firstSchedule = scheduleOf(first);
  const secondSchedule = scheduleOf(second);
  return {
    ...fixture,
    rounds: fixture.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => {
        if (match.officialId === officialIdA) {
          return { ...match, ...secondSchedule };
        }
        if (match.officialId === officialIdB) {
          return { ...match, ...firstSchedule };
        }
        return match;
      }),
    })),
  };
}
