export type ZonePairReplaceMatch = {
  pair1Id: string | null;
  pair2Id: string | null;
};

export type ZonePairReplaceDraft<TMatch extends ZonePairReplaceMatch> = {
  id: string;
  pairIds: string[];
  matches: TMatch[];
};

/** Parejas que aparecen en más de una zona. */
export function duplicatedZonePairIds(
  zones: { pairIds: string[] }[],
): Set<string> {
  const count = new Map<string, number>();
  for (const zone of zones) {
    for (const pairId of new Set(zone.pairIds)) {
      count.set(pairId, (count.get(pairId) ?? 0) + 1);
    }
  }
  const duplicated = new Set<string>();
  for (const [pairId, n] of count) {
    if (n > 1) duplicated.add(pairId);
  }
  return duplicated;
}

/**
 * Zonas con una pareja que también está en otra zona.
 * `excludeZoneId` omite la zona que se acaba de editar (queda como destino).
 */
export function inconsistentZoneIds(
  zones: { id: string; pairIds: string[] }[],
  excludeZoneId?: string | null,
): Set<string> {
  const duplicated = duplicatedZonePairIds(zones);
  const ids = new Set<string>();
  for (const zone of zones) {
    if (excludeZoneId && zone.id === excludeZoneId) continue;
    if (zone.pairIds.some((pairId) => duplicated.has(pairId))) {
      ids.add(zone.id);
    }
  }
  return ids;
}

export function inconsistentPairIdsInZone(
  zone: { pairIds: string[] },
  zones: { pairIds: string[] }[],
): Set<string> {
  const duplicated = duplicatedZonePairIds(zones);
  return new Set(zone.pairIds.filter((pairId) => duplicated.has(pairId)));
}

export function pairZoneLabelsById(
  zones: { label: string; pairIds: string[] }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const zone of zones) {
    for (const pairId of zone.pairIds) {
      const labels = map.get(pairId) ?? [];
      if (!labels.includes(zone.label)) labels.push(zone.label);
      map.set(pairId, labels);
    }
  }
  return map;
}

/** Reemplaza la pareja en los badges y en todos los partidos de la zona. */
export function replacePairInZone<
  TMatch extends ZonePairReplaceMatch,
  TZone extends ZonePairReplaceDraft<TMatch>,
>(zone: TZone, fromPairId: string, toPairId: string): TZone {
  if (!fromPairId || !toPairId || fromPairId === toPairId) return zone;
  if (!zone.pairIds.includes(fromPairId)) return zone;
  if (zone.pairIds.includes(toPairId)) return zone;

  return {
    ...zone,
    pairIds: zone.pairIds.map((id) => (id === fromPairId ? toPairId : id)),
    matches: zone.matches.map((match) => ({
      ...match,
      pair1Id: match.pair1Id === fromPairId ? toPairId : match.pair1Id,
      pair2Id: match.pair2Id === fromPairId ? toPairId : match.pair2Id,
    })),
  };
}
