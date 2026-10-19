import { readMatchScores, zoneScoreKey } from "./match-scores";
import {
  zonePairIdsOf,
  type ZonesFixturePersisted,
} from "./zones-fixture-schema";

export type ZoneScoreLossReason =
  | { kind: "zone_removed" }
  | { kind: "size_changed"; from: number; to: number }
  | {
      kind: "pair_left";
      pairId: string;
      toZone: string | null;
      stillEligible: boolean;
    }
  | { kind: "pair_joined"; pairId: string; fromZone: string | null }
  | { kind: "pairings_changed" };

export type ZoneScoreLoss = {
  zoneLabel: string;
  lostCount: number;
  reasons: ZoneScoreLossReason[];
};

function scoreSignature(value: unknown): string | null {
  const scores = readMatchScores(value);
  if (!scores) return null;
  const entries = Object.entries(scores)
    .filter(([, games]) => games !== "")
    .sort(([left], [right]) => left.localeCompare(right));
  return entries.length > 0 ? JSON.stringify(entries) : null;
}

/// Con las dos parejas, el resultado sigue valiendo aunque el partido cambie de
/// zona o de tipo; sin parejas solo se reconoce por zona y tipo.
function keptKey(
  zoneLabel: string,
  match: { kind?: string | null; pair1Id?: string | null; pair2Id?: string | null },
  signature: string,
) {
  const base =
    match.pair1Id && match.pair2Id
      ? `pairs|${[match.pair1Id, match.pair2Id].sort().join("|")}`
      : zoneScoreKey(zoneLabel, match);
  return `${base}#${signature}`;
}

function zoneByPair(fixture: ZonesFixturePersisted): Map<string, string> {
  const map = new Map<string, string>();
  for (const zone of fixture.zones) {
    for (const id of zonePairIdsOf(zone)) {
      if (!map.has(id)) map.set(id, zone.label);
    }
  }
  return map;
}

/// Resultados cargados en `previous` que no quedan en `next`, agrupados por zona.
export function findZoneScoreLosses(
  previous: ZonesFixturePersisted | null | undefined,
  next: ZonesFixturePersisted,
): ZoneScoreLoss[] {
  if (!previous) return [];

  const kept = new Set<string>();
  for (const zone of next.zones) {
    for (const match of zone.matches) {
      const signature = scoreSignature(match.scores);
      if (signature) kept.add(keptKey(zone.label, match, signature));
    }
  }

  const nextByLabel = new Map(next.zones.map((zone) => [zone.label, zone]));
  const previousZoneOf = zoneByPair(previous);
  const nextZoneOf = zoneByPair(next);
  const unassigned = new Set(next.unassignedPairIds);
  const losses: ZoneScoreLoss[] = [];

  for (const zone of previous.zones) {
    let lostCount = 0;
    for (const match of zone.matches) {
      const signature = scoreSignature(match.scores);
      if (!signature) continue;
      if (!kept.has(keptKey(zone.label, match, signature))) {
        lostCount += 1;
      }
    }
    if (lostCount === 0) continue;

    const reasons: ZoneScoreLossReason[] = [];
    const nextZone = nextByLabel.get(zone.label);
    const previousIds = zonePairIdsOf(zone);
    const nextIds = nextZone ? zonePairIdsOf(nextZone) : [];
    if (!nextZone) reasons.push({ kind: "zone_removed" });
    for (const id of previousIds) {
      if (nextIds.includes(id)) continue;
      reasons.push({
        kind: "pair_left",
        pairId: id,
        toZone: nextZoneOf.get(id) ?? null,
        stillEligible: nextZoneOf.has(id) || unassigned.has(id),
      });
    }
    for (const id of nextIds) {
      if (previousIds.includes(id)) continue;
      reasons.push({
        kind: "pair_joined",
        pairId: id,
        fromZone: previousZoneOf.get(id) ?? null,
      });
    }
    if (nextZone && previousIds.length !== nextIds.length) {
      reasons.push({
        kind: "size_changed",
        from: previousIds.length,
        to: nextIds.length,
      });
    }
    if (reasons.length === 0) reasons.push({ kind: "pairings_changed" });

    losses.push({ zoneLabel: zone.label, lostCount, reasons });
  }

  return losses;
}

export function describeZoneScoreLossReason(
  reason: ZoneScoreLossReason,
  zoneLabel: string,
  pairLabel: (pairId: string) => string,
): string {
  switch (reason.kind) {
    case "zone_removed":
      return `${zoneLabel} deja de existir.`;
    case "size_changed":
      return `Pasa de ${reason.from} a ${reason.to} parejas.`;
    case "pair_left":
      if (reason.toZone) {
        return `${pairLabel(reason.pairId)} pasa a ${reason.toZone}.`;
      }
      return reason.stillEligible
        ? `${pairLabel(reason.pairId)} queda sin zona.`
        : `${pairLabel(reason.pairId)} sale de las zonas (cancelada, sin compañero o sin confirmar).`;
    case "pair_joined":
      return reason.fromZone
        ? `Entra ${pairLabel(reason.pairId)} (estaba en ${reason.fromZone}).`
        : `Entra ${pairLabel(reason.pairId)}.`;
    case "pairings_changed":
      return "Mismas parejas, pero cambian los cruces de la zona.";
  }
}
