import {
  normalizeZone4Advancers,
  type Zone4Advancers,
} from "./config-schema";
import { distributeZoneSizes } from "./simulate-category-schedule";
import {
  advancersFromZoneSize,
  zoneLabelFromIndex,
  zoneMatchCount,
} from "./zone-bracket";

export type ZoneStructureKind =
  | "round_robin"
  | "opening_plus"
  | "single_match"
  | "incomplete";

export type ZoneDrawInfo = {
  label: string;
  size: number;
  matches: number;
  advancers: number;
  structure: ZoneStructureKind;
};

export type KnockoutRoundInfo = {
  key: string;
  label: string;
  pairSlots: number;
  matches: number;
};

export type DrawByPairCount = {
  pairCount: number;
  zones: ZoneDrawInfo[];
  zoneMatches: number;
  advancers: number;
  bracketSize: number;
  byes: number;
  firstRoundMatches: number;
  knockoutMatches: number;
  rounds: KnockoutRoundInfo[];
};

const ROUND_DEFS = [
  { size: 32, label: "16 avos" },
  { size: 16, label: "Octavos" },
  { size: 8, label: "Cuartos" },
  { size: 4, label: "Semifinal" },
  { size: 2, label: "Final" },
] as const;

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

export function zoneStructureKind(size: number): ZoneStructureKind {
  if (size === 3) return "round_robin";
  if (size === 4) return "opening_plus";
  if (size === 2) return "single_match";
  return "incomplete";
}

export const ZONE_STRUCTURE_LABELS: Record<ZoneStructureKind, string> = {
  round_robin: "Round-robin",
  opening_plus: "Apertura + G/G + P/P",
  single_match: "Un partido",
  incomplete: "Sin formato completo",
};

export function describeDrawByPairCount(
  pairCount: number,
  zone4Advancers: Zone4Advancers | number = 3,
): DrawByPairCount {
  const n = Math.max(0, Math.floor(pairCount));
  const fromZone4 = normalizeZone4Advancers(zone4Advancers);
  const sizes = distributeZoneSizes(n, 3);
  const zones = sizes.map((size, index) => ({
    label: zoneLabelFromIndex(index),
    size,
    matches: zoneMatchCount(size),
    advancers: advancersFromZoneSize(size, fromZone4),
    structure: zoneStructureKind(size),
  }));
  const zoneMatches = zones.reduce((sum, zone) => sum + zone.matches, 0);
  const advancers = zones.reduce((sum, zone) => sum + zone.advancers, 0);
  const bracketSize = advancers <= 1 ? 0 : nextPowerOfTwo(advancers);
  const byes = bracketSize > 0 ? bracketSize - advancers : 0;
  const firstRoundMatches =
    bracketSize <= 1
      ? 0
      : bracketSize === 2
        ? 1
        : Math.max(0, advancers - bracketSize / 2);
  const knockoutMatches = Math.max(0, advancers - 1);

  const rounds: KnockoutRoundInfo[] = [];
  if (bracketSize >= 2) {
    for (const round of ROUND_DEFS) {
      if (round.size > bracketSize) continue;
      const isFirst = round.size === bracketSize;
      rounds.push({
        key: `R${round.size}`,
        label: round.label,
        pairSlots: round.size,
        matches: isFirst ? firstRoundMatches : round.size / 2,
      });
    }
  }

  return {
    pairCount: n,
    zones,
    zoneMatches,
    advancers,
    bracketSize,
    byes,
    firstRoundMatches,
    knockoutMatches,
    rounds,
  };
}
