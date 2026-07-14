import type { MatchFormat } from "./config-schema";
import { distributeZoneSizes } from "./simulate-category-schedule";

export type ZoneResultColumn = {
  key: string;
  label: string;
  group?: string;
};

/// Tipo de partido dentro de una zona (3 = round-robin; 4 = apertura + G/G + P/P).
export type ZoneMatchKind =
  | "round_robin"
  | "opening"
  | "winners"
  | "losers";

export type ZonePairing<T> = {
  pair1: T | null;
  pair2: T | null;
  kind: ZoneMatchKind;
};

export const ZONE_MATCH_KIND_LABELS: Record<ZoneMatchKind, string> = {
  round_robin: "Round-robin",
  opening: "1.ª ronda",
  winners: "Ganador vs ganador",
  losers: "Perdedor vs perdedor",
};

/// Columnas de resultado según formato de la fase de zonas.
export function resultColumnsForFormat(
  format: MatchFormat,
): ZoneResultColumn[] {
  switch (format) {
    case "ONE_SET_6":
    case "ONE_SET_9":
      return [
        { key: "s1a", label: "P1", group: "Set" },
        { key: "s1b", label: "P2", group: "Set" },
      ];
    case "TWO_SETS_STB":
      return [
        { key: "s1a", label: "P1", group: "Set 1" },
        { key: "s1b", label: "P2", group: "Set 1" },
        { key: "s2a", label: "P1", group: "Set 2" },
        { key: "s2b", label: "P2", group: "Set 2" },
        { key: "stba", label: "P1", group: "STB" },
        { key: "stbb", label: "P2", group: "STB" },
      ];
    case "BEST_OF_3":
      return [
        { key: "s1a", label: "P1", group: "Set 1" },
        { key: "s1b", label: "P2", group: "Set 1" },
        { key: "s2a", label: "P1", group: "Set 2" },
        { key: "s2b", label: "P2", group: "Set 2" },
        { key: "s3a", label: "P1", group: "Set 3" },
        { key: "s3b", label: "P2", group: "Set 3" },
      ];
    default:
      return [
        { key: "s1a", label: "P1", group: "Set" },
        { key: "s1b", label: "P2", group: "Set" },
      ];
  }
}

export function emptyScoresForFormat(format: MatchFormat): Record<string, string> {
  return Object.fromEntries(
    resultColumnsForFormat(format).map((c) => [c.key, ""]),
  );
}

/// Emparejamientos round-robin (índices o ids).
export function roundRobinPairings<T>(items: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      out.push([items[i], items[j]]);
    }
  }
  return out;
}

/**
 * Fixture de zona:
 * - 3 parejas: round-robin (3 partidos). Pasan 2.
 * - 4 parejas: 2 de apertura + ganador/ganador + perdedor/perdedor (4 partidos).
 *   Cada pareja juega 2; pasan 3.
 */
export function zonePairings<T>(items: T[]): ZonePairing<T>[] {
  if (items.length === 3) {
    // Orden AB → BC → AC: reparte mejor los 2 partidos de cada pareja
    // entre días/horarios (evita empujar el 2.º de B al slot siguiente del 1.º).
    return [
      { pair1: items[0], pair2: items[1], kind: "round_robin" as const },
      { pair1: items[1], pair2: items[2], kind: "round_robin" as const },
      { pair1: items[0], pair2: items[2], kind: "round_robin" as const },
    ];
  }

  if (items.length === 4) {
    return [
      { pair1: items[0], pair2: items[1], kind: "opening" },
      { pair1: items[2], pair2: items[3], kind: "opening" },
      { pair1: null, pair2: null, kind: "winners" },
      { pair1: null, pair2: null, kind: "losers" },
    ];
  }

  return roundRobinPairings(items).map(([pair1, pair2]) => ({
    pair1,
    pair2,
    kind: "round_robin" as const,
  }));
}

export function zoneLabelFromIndex(index: number): string {
  if (index < 26) return `Zona ${String.fromCharCode(65 + index)}`;
  return `Zona ${index + 1}`;
}

/// Cantidad de partidos de zona según tamaño (formato VeloxCourt, no RR puro en 4).
export function zoneMatchCount(zoneSize: number): number {
  if (zoneSize < 2) return 0;
  if (zoneSize === 3) return 3;
  if (zoneSize === 4) return 4;
  return (zoneSize * (zoneSize - 1)) / 2;
}

/** @deprecated Usar zoneMatchCount — el nombre anterior sugería round-robin puro. */
export function roundRobinMatchCount(zoneSize: number): number {
  return zoneMatchCount(zoneSize);
}

/// Cuántas parejas avanzan desde una zona.
export function advancersFromZoneSize(zoneSize: number): number {
  if (zoneSize >= 4) return 3;
  if (zoneSize === 3) return 2;
  if (zoneSize === 2) return 1;
  return 0;
}

export function plannedZoneCount(
  pairCount: number,
  pairsPerZone: number,
): number {
  return distributeZoneSizes(pairCount, pairsPerZone || 3).length;
}
