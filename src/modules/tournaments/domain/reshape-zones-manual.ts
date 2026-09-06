import { distributeZoneSizes } from "./simulate-category-schedule";
import { zoneLabelFromIndex, zonePairings } from "./zone-bracket";
import type { ScheduledZone, ScheduledZoneMatch, ZonesFixtureResult } from "./build-zones-fixture";
import type { ZonesFixturePersisted } from "./zones-fixture-schema";

type PreviousMatch = ScheduledZoneMatch & {
  scores?: Record<string, string>;
};

type PreviousZone = {
  label: string;
  pairIds: string[];
  originalCount: number;
  matches: PreviousMatch[];
};

function pairingKey(
  pair1Id: string | null | undefined,
  pair2Id: string | null | undefined,
): string | null {
  if (!pair1Id || !pair2Id) return null;
  return [pair1Id, pair2Id].sort().join("|");
}

function unscheduledMatches(pairIds: string[]): ScheduledZoneMatch[] {
  return zonePairings(pairIds).map((pairing, matchIndex) => ({
    matchIndex,
    kind: pairing.kind,
    playDate: null,
    startTime: null,
    endTime: null,
    courtIndex: null,
    pair1Id: pairing.pair1,
    pair2Id: pairing.pair2,
    slotIndex: null,
  }));
}

function carryMatchSchedules(
  preferred: PreviousMatch[],
  fallback: PreviousMatch[],
  next: ScheduledZoneMatch[],
): ScheduledZoneMatch[] {
  const byPairing = new Map<string, PreviousMatch>();
  for (const match of [...fallback, ...preferred]) {
    const key = pairingKey(match.pair1Id, match.pair2Id);
    if (!key) continue;
    const current = byPairing.get(key);
    const incomingHasSchedule = Boolean(match.playDate || match.startTime);
    if (!current || incomingHasSchedule) byPairing.set(key, match);
  }

  return next.map((match) => {
    const key = pairingKey(match.pair1Id, match.pair2Id);
    const previous = key ? byPairing.get(key) : undefined;
    if (!previous) return match;
    return {
      ...match,
      playDate: previous.playDate,
      startTime: previous.startTime,
      endTime: previous.endTime ?? null,
      courtIndex: previous.courtIndex,
      slotIndex: previous.slotIndex ?? null,
      noRestGap: previous.noRestGap,
      ...(previous.scores ? { scores: previous.scores } : {}),
    };
  });
}

function zoneFromPairs(
  label: string,
  pairIds: string[],
  preferred: PreviousMatch[],
  fallback: PreviousMatch[],
): ScheduledZone {
  return {
    label,
    pairIds,
    matches: carryMatchSchedules(preferred, fallback, unscheduledMatches(pairIds)),
  };
}

function keepZoneAsIs(zone: ScheduledZone): ScheduledZone {
  return {
    label: zone.label,
    pairIds: [...zone.pairIds],
    matches: zone.matches.map((match, matchIndex) => ({
      ...match,
      matchIndex,
    })),
  };
}

function pairIdsFromZone(zone: {
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

function sortZoneLabel(left: string, right: string): number {
  return left.localeCompare(right, "es", { numeric: true });
}

/// Actualizar en Modo Manual: solo ajusta el formato 3/4.
/// Las zonas de 4 van primero (A, y B si hay dos), como en FAP.
/// Conserva parejas, día, horario y cancha de lo que sigue igual.
/// Si un cruce se mantiene, también conserva su programación.
export function reshapeZonesForManualUpdate(params: {
  previous: ZonesFixturePersisted | null | undefined;
  pairIds: string[];
  pairsPerZone?: number;
}): ZonesFixtureResult {
  const eligible = [...new Set(params.pairIds)];
  const eligibleSet = new Set(eligible);
  const sizes = distributeZoneSizes(eligible.length, params.pairsPerZone || 3);
  const targets = sizes.map((size, index) => ({
    label: zoneLabelFromIndex(index),
    size,
  }));
  const targetLabels = new Set(targets.map((target) => target.label));

  const previousZones: PreviousZone[] = (params.previous?.zones ?? []).map(
    (zone) => {
      const rawIds = pairIdsFromZone(zone);
      return {
        label: zone.label,
        originalCount: rawIds.length,
        pairIds: rawIds.filter((id) => eligibleSet.has(id)),
        matches: zone.matches.map((match, matchIndex) => ({
          ...match,
          matchIndex,
          endTime: match.endTime ?? null,
        })),
      };
    },
  );

  const existingByLabel = new Map<string, PreviousZone>();
  const extraZones: PreviousZone[] = [];
  for (const zone of previousZones) {
    if (!targetLabels.has(zone.label) || existingByLabel.has(zone.label)) {
      extraZones.push(zone);
      continue;
    }
    existingByLabel.set(zone.label, zone);
  }

  const allPreviousMatches = previousZones.flatMap((zone) => zone.matches);
  const assigned = new Set<string>();
  const pool: string[] = [];
  const warnings: string[] = [
    "Se ajustó el formato de zonas (3/4). Se conservó día, horario y cancha donde el cruce sigue igual.",
  ];

  const drafts: Array<{
    label: string;
    size: number;
    previousCount: number | null;
    preferred: PreviousMatch[];
    zone: ScheduledZone;
    intact: boolean;
  }> = [];

  for (const target of targets) {
    const existing = existingByLabel.get(target.label);
    if (!existing) {
      drafts.push({
        label: target.label,
        size: target.size,
        previousCount: null,
        preferred: [],
        zone: zoneFromPairs(target.label, [], [], allPreviousMatches),
        intact: false,
      });
      continue;
    }

    const ids = existing.pairIds.filter((id) => {
      if (assigned.has(id)) return false;
      assigned.add(id);
      return true;
    });
    const keepIds = ids.length > target.size ? ids.slice(0, target.size) : ids;
    if (ids.length > target.size) pool.push(...ids.slice(target.size));

    const intact =
      keepIds.length === target.size && samePairSet(keepIds, existing.pairIds);

    drafts.push({
      label: target.label,
      size: target.size,
      previousCount: existing.originalCount,
      preferred: existing.matches,
      zone: intact
        ? keepZoneAsIs({
            label: existing.label,
            pairIds: keepIds,
            matches: existing.matches,
          })
        : zoneFromPairs(
            target.label,
            keepIds,
            existing.matches,
            allPreviousMatches,
          ),
      intact,
    });
  }

  for (const zone of extraZones) {
    const leftover = zone.pairIds.filter((id) => !assigned.has(id));
    for (const id of leftover) assigned.add(id);
    pool.push(...leftover);
    if (leftover.length > 0) {
      warnings.push(
        `${zone.label}: se usó para completar el formato 3/4.`,
      );
    }
  }

  for (const id of eligible) {
    if (!assigned.has(id)) pool.push(id);
  }

  for (const draft of drafts) {
    if (draft.zone.pairIds.length < draft.size) {
      const added = pool.splice(0, draft.size - draft.zone.pairIds.length);
      draft.zone = zoneFromPairs(
        draft.label,
        [...draft.zone.pairIds, ...added],
        draft.preferred,
        allPreviousMatches,
      );
      draft.intact = false;
    }

    if (
      draft.previousCount !== null &&
      draft.previousCount !== draft.zone.pairIds.length
    ) {
      warnings.push(
        `${draft.label}: pasó de ${draft.previousCount} a ${draft.zone.pairIds.length} parejas.`,
      );
    }

    if (draft.zone.pairIds.length < draft.size) {
      warnings.push(
        `${draft.label}: quedó incompleta (${draft.zone.pairIds.length} de ${draft.size} parejas).`,
      );
    }
  }

  const kept = drafts
    .map((draft) => draft.zone)
    .sort((left, right) => sortZoneLabel(left.label, right.label));

  return {
    zones: kept,
    warnings,
    unassignedPairIds: pool,
    builtAt: new Date().toISOString(),
  };
}
