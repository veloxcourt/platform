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
