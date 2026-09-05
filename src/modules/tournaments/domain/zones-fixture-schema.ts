import { z } from "zod";
import type { ZonesFixtureResult } from "./build-zones-fixture";
import {
  applyZoneScores,
  collectZoneScores,
  matchScoresSchema,
} from "./match-scores";

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
  ruleBreaks: z
    .array(z.enum(["rest", "day_pref", "cell_pref"]))
    .optional(),
  scores: matchScoresSchema.optional(),
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

export const zonesFixtureDraftSchema = z.object({
  zones: z.array(
    z.object({
      label: z.string().min(1),
      pairIds: z.array(z.string()),
      matches: z.array(
        z.object({
          kind: z
            .enum(["round_robin", "opening", "winners", "losers"])
            .optional(),
          playDate: z.string(),
          startTime: z.string(),
          courtIndex: z.number().int().min(0).nullable(),
          pair1Id: z.string().nullable(),
          pair2Id: z.string().nullable(),
          noRestGap: z.boolean().optional(),
          ruleBreaks: z
            .array(z.enum(["rest", "day_pref", "cell_pref"]))
            .optional(),
          scores: matchScoresSchema.optional(),
        }),
      ),
    }),
  ),
});

export type ZonesFixtureDraftInput = z.infer<typeof zonesFixtureDraftSchema>;

function pairIdsFromDraftZone(
  zone: ZonesFixtureDraftInput["zones"][number],
): string[] {
  const fromMatches = new Set<string>();
  for (const match of zone.matches) {
    if (match.pair1Id) fromMatches.add(match.pair1Id);
    if (match.pair2Id) fromMatches.add(match.pair2Id);
  }
  const kept = zone.pairIds.filter((id) => fromMatches.has(id));
  const extra = [...fromMatches].filter((id) => !kept.includes(id));
  return [...kept, ...extra];
}

export function zonesDraftToPersisted(
  draft: ZonesFixtureDraftInput,
  previous: ZonesFixturePersisted | null,
): ZonesFixturePersisted {
  return {
    zones: draft.zones.map((zone) => ({
      label: zone.label,
      pairIds: pairIdsFromDraftZone(zone),
      matches: zone.matches.map((match, matchIndex) => ({
        matchIndex,
        kind: match.kind ?? "round_robin",
        playDate: match.playDate.trim() || null,
        startTime: match.startTime.trim() || null,
        courtIndex: match.courtIndex,
        pair1Id: match.pair1Id,
        pair2Id: match.pair2Id,
        noRestGap: match.noRestGap,
        ruleBreaks: match.ruleBreaks,
        scores: match.scores,
      })),
    })),
    warnings: previous?.warnings ?? [],
    unassignedPairIds: previous?.unassignedPairIds ?? [],
    builtAt: previous?.builtAt ?? new Date().toISOString(),
  };
}

export function mergeZoneDraftScores(
  previous: ZonesFixturePersisted,
  draft: ZonesFixtureDraftInput,
): ZonesFixturePersisted {
  return applyZoneScores(previous, collectZoneScores(draft));
}

export function carryZoneScores(
  previous: ZonesFixturePersisted | null | undefined,
  next: ZonesFixturePersisted,
): ZonesFixturePersisted {
  return applyZoneScores(next, collectZoneScores(previous));
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
