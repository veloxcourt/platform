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

export const zoneTieBreakSchema = z.object({
  pairIds: z.array(z.string()).min(2),
  orderedPairIds: z.array(z.string()).min(2),
});

export const zonesFixtureZoneSchema = z.object({
  label: z.string().min(1),
  pairIds: z.array(z.string()),
  matches: z.array(zonesFixtureMatchSchema),
  tieBreaks: z.array(zoneTieBreakSchema).optional(),
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
      tieBreaks: z.array(zoneTieBreakSchema).optional(),
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
      tieBreaks: zone.tieBreaks,
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

function collectZoneTieBreaks(
  fixture:
    | { zones: Array<{ label: string; tieBreaks?: ZonesFixturePersisted["zones"][number]["tieBreaks"] }> }
    | null
    | undefined,
) {
  const map = new Map<
    string,
    NonNullable<ZonesFixturePersisted["zones"][number]["tieBreaks"]>
  >();
  for (const zone of fixture?.zones ?? []) {
    if (zone.tieBreaks?.length) map.set(zone.label, zone.tieBreaks);
  }
  return map;
}

function applyZoneTieBreaks<
  T extends { zones: Array<{ label: string; tieBreaks?: ZonesFixturePersisted["zones"][number]["tieBreaks"] }> },
>(fixture: T, tieBreaksByLabel: ReturnType<typeof collectZoneTieBreaks>): T {
  if (tieBreaksByLabel.size === 0) return fixture;
  return {
    ...fixture,
    zones: fixture.zones.map((zone) => ({
      ...zone,
      tieBreaks: tieBreaksByLabel.get(zone.label) ?? zone.tieBreaks,
    })),
  };
}

export function mergeZoneDraftScores(
  previous: ZonesFixturePersisted,
  draft: ZonesFixtureDraftInput,
): ZonesFixturePersisted {
  return applyZoneTieBreaks(
    applyZoneScores(previous, collectZoneScores(draft)),
    collectZoneTieBreaks(draft),
  );
}

export function zonePairIdsOf(zone: {
  pairIds: string[];
  matches: Array<{ pair1Id?: string | null; pair2Id?: string | null }>;
}): string[] {
  if (zone.pairIds.length > 0) return [...zone.pairIds];
  const ids: string[] = [];
  for (const match of zone.matches) {
    if (match.pair1Id && !ids.includes(match.pair1Id)) ids.push(match.pair1Id);
    if (match.pair2Id && !ids.includes(match.pair2Id)) ids.push(match.pair2Id);
  }
  return ids;
}

function samePairSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const other = new Set(right);
  return left.every((id) => other.has(id));
}

/// Un partido sin parejas (ganador vs ganador, perdedor vs perdedor) solo se
/// identifica por zona y tipo: si la zona cambió de parejas, su resultado
/// sería de otras parejas.
function dropOrphanedOpenScores(
  previous: ZonesFixturePersisted,
  next: ZonesFixturePersisted,
): ZonesFixturePersisted {
  const nextPairsByLabel = new Map(
    next.zones.map((zone) => [zone.label, zonePairIdsOf(zone)]),
  );
  return {
    ...previous,
    zones: previous.zones.map((zone) => {
      const nextIds = nextPairsByLabel.get(zone.label);
      if (nextIds && samePairSet(zonePairIdsOf(zone), nextIds)) return zone;
      return {
        ...zone,
        matches: zone.matches.map((match) =>
          match.pair1Id && match.pair2Id ? match : { ...match, scores: undefined },
        ),
      };
    }),
  };
}

export function carryZoneScores(
  previous: ZonesFixturePersisted | null | undefined,
  next: ZonesFixturePersisted,
): ZonesFixturePersisted {
  const carried = previous ? dropOrphanedOpenScores(previous, next) : previous;
  return applyZoneTieBreaks(
    applyZoneScores(next, collectZoneScores(carried)),
    collectZoneTieBreaks(previous),
  );
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
