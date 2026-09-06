import type { BracketRound } from "./config-schema";
import {
  OFFICIAL_LABEL_TO_BRACKET_ROUND,
  officialPhaseInstances,
} from "./intermediate-phase";
import type { CategoryPhaseConfig } from "./types";

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function gcdOf(values: number[]): number {
  const positives = values.filter((value) => value > 0);
  if (positives.length === 0) return 1;
  return positives.reduce((acc, value) => gcd(acc, value));
}

/// Paso visual de la grilla: el slot más corto del día. Un partido más largo
/// ocupa varias cajas del mismo tamaño; no se achica ni se estira la caja.
export function slotStepMinutes(values: number[], fallback: number): number {
  const positives = values.filter((value) => value > 0);
  if (positives.length === 0) return Math.max(1, fallback);
  return Math.min(...positives);
}

export type InstanceSlotLoad = {
  phase: "knockout" | "final";
  key: BracketRound;
  label: string;
  matchCount: number;
  slotMinutes: number;
  playDates: string[];
};

export function instanceSlotMinutes(
  config: CategoryPhaseConfig,
  key: BracketRound,
  fallbackDuration: number,
): number {
  const duration =
    config.rounds?.[key]?.matchDurationMin ?? fallbackDuration;
  return Math.max(1, duration + config.intervalMin);
}

export function instancePlayDates(
  config: CategoryPhaseConfig,
  key: BracketRound,
  fallback: string[],
): string[] {
  const dates = config.rounds?.[key]?.playDates ?? [];
  const source = dates.length > 0 ? dates : fallback;
  return source.filter(Boolean);
}

export function categoryInstanceLoads(
  config: CategoryPhaseConfig,
  pairCount: number,
): InstanceSlotLoad[] {
  const startsAt = config.phases.final.startsAtRound;
  const instances = officialPhaseInstances({
    pairCount,
    zone4Advancers: config.zone4Advancers === 2 ? 2 : 3,
    startsAt,
  });

  const loads: InstanceSlotLoad[] = [];
  for (const round of instances.knockout) {
    const key = OFFICIAL_LABEL_TO_BRACKET_ROUND[round.label];
    if (!key) continue;
    loads.push({
      phase: "knockout",
      key,
      label: round.label,
      matchCount: round.crossings.length,
      slotMinutes: instanceSlotMinutes(
        config,
        key,
        config.phases.knockout.matchDurationMin,
      ),
      playDates: instancePlayDates(
        config,
        key,
        config.phases.knockout.playDates,
      ),
    });
  }
  for (const round of instances.final) {
    const key = OFFICIAL_LABEL_TO_BRACKET_ROUND[round.label];
    if (!key) continue;
    loads.push({
      phase: "final",
      key,
      label: round.label,
      matchCount: round.crossings.length,
      slotMinutes: instanceSlotMinutes(
        config,
        key,
        config.phases.final.matchDurationMin,
      ),
      playDates: instancePlayDates(config, key, config.phases.final.playDates),
    });
  }
  return loads;
}

export function fixtureCellMinutes(
  items: Array<{
    config: CategoryPhaseConfig;
    pairCount: number;
    phase: "knockout" | "final";
  }>,
  fallback: number,
): number {
  const sizes = items.flatMap(({ config, pairCount, phase }) =>
    categoryInstanceLoads(config, pairCount)
      .filter((load) => load.phase === phase)
      .map((load) => load.slotMinutes),
  );
  return slotStepMinutes(sizes, fallback);
}

export function slotMinutesForOfficialLabel(
  config: CategoryPhaseConfig,
  label: string,
  phase: "knockout" | "final",
): number {
  const key = OFFICIAL_LABEL_TO_BRACKET_ROUND[label];
  const fallback =
    phase === "knockout"
      ? config.phases.knockout.matchDurationMin
      : config.phases.final.matchDurationMin;
  if (!key) return Math.max(1, fallback + config.intervalMin);
  return instanceSlotMinutes(config, key, fallback);
}
