import { z } from "zod";
import type { ZonesFixtureResult } from "./build-zones-fixture";

export const zonesFixtureMatchSchema = z.object({
  matchIndex: z.number().int().min(0),
  kind: z.enum(["round_robin", "opening", "winners", "losers"]),
  playDate: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable().optional(),
  courtIndex: z.number().int().min(0).nullable(),
  pair1Id: z.string().nullable(),
  pair2Id: z.string().nullable(),
  slotIndex: z.number().int().min(0).nullable().optional(),
  noRestGap: z.boolean().optional(),
});

export const zonesFixtureZoneSchema = z.object({
  label: z.string().min(1),
  pairIds: z.array(z.string()),
  matches: z.array(zonesFixtureMatchSchema),
});

export const zonesFixtureSchema = z.object({
  zones: z.array(zonesFixtureZoneSchema),
  warnings: z.array(z.string()).default([]),
  unassignedPairIds: z.array(z.string()).default([]),
  builtAt: z.string(),
});

export type ZonesFixturePersisted = z.infer<typeof zonesFixtureSchema>;

export function parseZonesFixture(value: unknown): ZonesFixturePersisted | null {
  const parsed = zonesFixtureSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toPersistedZonesFixture(
  result: ZonesFixtureResult,
): ZonesFixturePersisted {
  return {
    zones: result.zones,
    warnings: result.warnings,
    unassignedPairIds: result.unassignedPairIds,
    builtAt: result.builtAt,
  };
}
