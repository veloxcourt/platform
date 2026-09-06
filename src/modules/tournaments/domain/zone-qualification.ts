import { z } from "zod";

import { formatAbbreviatedPairLabel } from "@/lib/person-name";
import type { MatchFormat } from "./config-schema";
import type { IntermediateFixturePersisted } from "./intermediate-fixture-schema";
import type { PairListItem } from "./types";
import { zoneLetterFromLabel } from "./zone-bracket";
import {
  computeZoneStandings,
  evaluateZoneMatch,
  type ZoneStandingOutcome,
} from "./zone-standings";
import type { ZonesFixturePersisted } from "./zones-fixture-schema";

export const zoneQualificationRowSchema = z.object({
  pairId: z.string(),
  rank: z.number().int().nullable(),
  outcome: z.enum(["advance", "out", "playoff", "pending"]),
  outcomeLabel: z.string(),
  points: z.number().int(),
  setDiff: z.number().int(),
  gameDiff: z.number().int(),
  gamesFor: z.number().int(),
  gamesAgainst: z.number().int(),
});

export const zoneQualificationSeedSchema = z.object({
  key: z.string(),
  label: z.string(),
  pairId: z.string(),
  zoneLabel: z.string(),
  place: z.number().int().min(1).max(3),
});

export const zoneQualificationSchema = z.object({
  computedAt: z.string(),
  zones: z.array(
    z.object({
      label: z.string(),
      regulation: z.enum(["FAP", "APA"]),
      advancers: z.number().int(),
      rows: z.array(zoneQualificationRowSchema),
    }),
  ),
  seeds: z.array(zoneQualificationSeedSchema),
  warnings: z.array(z.string()),
});

export type ZoneQualificationPersisted = z.infer<typeof zoneQualificationSchema>;

export function parseZoneQualification(
  value: unknown,
): ZoneQualificationPersisted | null {
  const parsed = zoneQualificationSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseQualifierToken(
  label: string,
): { place: number; zone: string } | null {
  const match = label.trim().match(/^([123])\s*°?\s*([A-L])$/i);
  if (!match) return null;
  return { place: Number(match[1]), zone: match[2]!.toUpperCase() };
}

export function parseWinnerOfficialId(label: string): number | null {
  const match = label.trim().match(/^ganador\s*n[°º.]?\s*(\d+)$/i);
  return match ? Number(match[1]) : null;
}

export function qualifierSeedKey(place: number, zoneLetter: string): string {
  return `${place}${zoneLetter.toUpperCase()}`;
}

export function pairDisplayName(pair: PairListItem): string {
  return formatAbbreviatedPairLabel(pair.player1.name, pair.player2?.name);
}

export function qualificationFromCategory(category: {
  zonesFixture?: ZonesFixturePersisted | null;
  phases: { zones: { matchFormat: MatchFormat } };
  zone4Advancers: 2 | 3;
}): ZoneQualificationPersisted {
  return buildZoneQualification({
    fixture: category.zonesFixture,
    format: category.phases.zones.matchFormat,
    zone4Advancers: category.zone4Advancers === 2 ? 2 : 3,
  });
}

export function buildZoneQualification({
  fixture,
  format,
  zone4Advancers,
}: {
  fixture: ZonesFixturePersisted | null | undefined;
  format: MatchFormat;
  zone4Advancers: 2 | 3;
}): ZoneQualificationPersisted {
  const warnings: string[] = [];
  const seeds: ZoneQualificationPersisted["seeds"] = [];
  const zones: ZoneQualificationPersisted["zones"] = [];

  if (!fixture?.zones.length) {
    return {
      computedAt: new Date().toISOString(),
      zones: [],
      seeds: [],
      warnings: ["Todavía no hay zonas armadas para calcular."],
    };
  }

  for (const zone of fixture.zones) {
    const standings = computeZoneStandings({
      pairIds: zone.pairIds,
      matches: zone.matches.map((match) => ({
        pair1Id: match.pair1Id,
        pair2Id: match.pair2Id,
        kind: match.kind,
        scores: match.scores ?? {},
      })),
      format,
      zone4Advancers,
      tieBreaks: zone.tieBreaks,
    });
    const letter = zoneLetterFromLabel(zone.label);
    zones.push({
      label: zone.label,
      regulation: standings.regulation,
      advancers: standings.advancers,
      rows: standings.rows.map((row) => ({
        pairId: row.pairId,
        rank: row.rank,
        outcome: row.outcome as ZoneStandingOutcome,
        outcomeLabel: row.outcomeLabel,
        points: row.points,
        setDiff: row.setDiff,
        gameDiff: row.gameDiff,
        gamesFor: row.gamesFor,
        gamesAgainst: row.gamesAgainst,
      })),
    });

    for (const reason of standings.pendingReasons) {
      warnings.push(`${zone.label}: ${reason}`);
    }

    const playoff = standings.rows.filter((row) => row.outcome === "playoff");
    if (playoff.length > 0) {
      warnings.push(
        `${zone.label}: hay empate para definir el puesto. Se define en cancha.`,
      );
    }

    for (const row of standings.rows) {
      if (row.rank == null || row.outcome !== "advance") continue;
      seeds.push({
        key: qualifierSeedKey(row.rank, letter),
        label: `${row.rank}° ${letter}`,
        pairId: row.pairId,
        zoneLabel: zone.label,
        place: row.rank as 1 | 2 | 3,
      });
    }
  }

  if (seeds.length === 0) {
    warnings.push("Ningún puesto de zona quedó definido todavía.");
  }

  return {
    computedAt: new Date().toISOString(),
    zones,
    seeds,
    warnings,
  };
}

function pairNameById(pairs: PairListItem[]): Map<string, string> {
  return new Map(pairs.map((pair) => [pair.id, pairDisplayName(pair)]));
}

function seedPairByKey(
  qualification: ZoneQualificationPersisted | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const seed of qualification?.seeds ?? []) {
    map.set(seed.key.toUpperCase(), seed.pairId);
  }
  return map;
}

function isByeLabel(label: string): boolean {
  return /^bye$/i.test(label.trim());
}

function pairIdFromSide(
  label: string,
  seeds: Map<string, string>,
  winners: Map<number, string>,
): string | null {
  if (isByeLabel(label)) return null;
  const qualifier = parseQualifierToken(label);
  if (qualifier) {
    return seeds.get(qualifierSeedKey(qualifier.place, qualifier.zone)) ?? null;
  }
  const officialId = parseWinnerOfficialId(label);
  if (officialId != null) return winners.get(officialId) ?? null;
  return null;
}

type KnockoutFixtureSource = {
  fixture?: IntermediateFixturePersisted | null;
  matchFormat: MatchFormat;
};

function buildWinnerMap(
  fixtures: KnockoutFixtureSource[],
  seeds: Map<string, string>,
): Map<number, string> {
  const matches = fixtures.flatMap((source) =>
    (source.fixture?.rounds ?? []).flatMap((round) =>
      round.matches.map((match) => ({
        match,
        matchFormat: source.matchFormat,
      })),
    ),
  );
  const winners = new Map<number, string>();
  for (let pass = 0; pass < 8; pass += 1) {
    let added = 0;
    for (const { match, matchFormat } of matches) {
      if (winners.has(match.officialId)) continue;
      const leftId = pairIdFromSide(match.left, seeds, winners);
      const rightId = pairIdFromSide(match.right, seeds, winners);
      const leftBye = isByeLabel(match.left);
      const rightBye = isByeLabel(match.right);
      if (leftBye && rightId) {
        winners.set(match.officialId, rightId);
        added += 1;
        continue;
      }
      if (rightBye && leftId) {
        winners.set(match.officialId, leftId);
        added += 1;
        continue;
      }
      if (!leftId || !rightId) continue;
      const result = evaluateZoneMatch(
        {
          pair1Id: leftId,
          pair2Id: rightId,
          scores: match.scores ?? {},
        },
        matchFormat,
      );
      if (!result.winnerPairId) continue;
      winners.set(match.officialId, result.winnerPairId);
      added += 1;
    }
    if (added === 0) break;
  }
  return winners;
}

export function buildKnockoutNameResolver({
  qualification,
  pairs,
  fixtures,
}: {
  qualification: ZoneQualificationPersisted | null | undefined;
  pairs: PairListItem[];
  fixtures: KnockoutFixtureSource[];
  matchFormat?: MatchFormat;
}): (label: string) => string {
  const names = pairNameById(pairs);
  const seeds = seedPairByKey(qualification);
  const winners = buildWinnerMap(fixtures, seeds);

  return (label: string) => {
    const pairId = pairIdFromSide(label, seeds, winners);
    if (!pairId) return label;
    return names.get(pairId) ?? label;
  };
}
