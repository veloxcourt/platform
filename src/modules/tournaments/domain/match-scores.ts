import { z } from "zod";

export const matchScoresSchema = z.record(z.string(), z.string());

export function readMatchScores(
  value: unknown,
): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "string") continue;
    out[key] = raw.replace(/\D/g, "").slice(0, 2);
  }
  return out;
}

export function normalizeMatchScores(
  value: unknown,
): Record<string, string> {
  const scores = readMatchScores(value);
  if (!scores) return {};
  return Object.fromEntries(
    Object.entries(scores).filter(([, games]) => games !== ""),
  );
}

export function mergeScoreMaps(
  base: Record<string, string>,
  extra?: Record<string, string> | null,
): Record<string, string> {
  return { ...base, ...normalizeMatchScores(extra) };
}

function pairKey(
  pair1Id: string | null | undefined,
  pair2Id: string | null | undefined,
) {
  return [pair1Id ?? "", pair2Id ?? ""].sort().join("|");
}

export function zoneScoreKey(
  zoneLabel: string,
  match: {
    kind?: string | null;
    pair1Id?: string | null;
    pair2Id?: string | null;
  },
) {
  return `${zoneLabel}|${match.kind ?? ""}|${pairKey(match.pair1Id, match.pair2Id)}`;
}

type ZoneScoreCarrier = {
  zones: Array<{
    label: string;
    matches: Array<{
      kind?: string | null;
      pair1Id?: string | null;
      pair2Id?: string | null;
      scores?: Record<string, string> | null;
    }>;
  }>;
};

function hasScoreValues(scores: Record<string, string>) {
  return Object.values(scores).some((value) => value !== "");
}

export function collectZoneScores(
  fixture: ZoneScoreCarrier | null | undefined,
): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  for (const zone of fixture?.zones ?? []) {
    for (const match of zone.matches) {
      const scores = readMatchScores(match.scores);
      if (!scores || !hasScoreValues(scores)) continue;
      map.set(zoneScoreKey(zone.label, match), scores);
    }
  }
  return map;
}

export function applyZoneScores<T extends ZoneScoreCarrier>(
  fixture: T,
  scoresByKey: Map<string, Record<string, string>>,
): T {
  if (scoresByKey.size === 0) return fixture;
  return {
    ...fixture,
    zones: fixture.zones.map((zone) => ({
      ...zone,
      matches: zone.matches.map((match) => ({
        ...match,
        scores:
          scoresByKey.get(zoneScoreKey(zone.label, match)) ?? match.scores,
      })),
    })),
  };
}

type KnockoutScoreCarrier = {
  rounds: Array<{
    matches: Array<{
      officialId: number;
      scores?: Record<string, string> | null;
    }>;
  }>;
};

export function collectKnockoutScores(
  fixture: KnockoutScoreCarrier | null | undefined,
): Map<number, Record<string, string>> {
  const map = new Map<number, Record<string, string>>();
  for (const round of fixture?.rounds ?? []) {
    for (const match of round.matches) {
      const scores = readMatchScores(match.scores);
      if (!scores || !hasScoreValues(scores)) continue;
      map.set(match.officialId, scores);
    }
  }
  return map;
}

export function applyKnockoutScores<T extends KnockoutScoreCarrier>(
  fixture: T,
  scoresById: Map<number, Record<string, string>>,
): T {
  if (scoresById.size === 0) return fixture;
  return {
    ...fixture,
    rounds: fixture.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => ({
        ...match,
        scores: scoresById.get(match.officialId) ?? match.scores,
      })),
    })),
  };
}

export function setKnockoutMatchScore<T extends KnockoutScoreCarrier>(
  fixture: T,
  officialId: number,
  key: string,
  value: string,
): T {
  const cleaned = value.replace(/\D/g, "").slice(0, 2);
  return {
    ...fixture,
    rounds: fixture.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) =>
        match.officialId === officialId
          ? {
              ...match,
              scores: {
                ...(readMatchScores(match.scores) ?? {}),
                [key]: cleaned,
              },
            }
          : match,
      ),
    })),
  };
}
