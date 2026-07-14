import {
  buildZonesRegistrationGrid,
  ZONES_SLOTS_PER_PAIR,
  type CourtDaySlot,
  type SlotReservationRef,
} from "./court-day-slots";
import type { CategoryPhaseConfig } from "./types";
import type { PlayDayValues } from "./config-schema";
import { simulateCategorySchedule } from "./simulate-category-schedule";

export function estimateIntermediateMatches(
  confirmedPairs: number,
  categoryConfig: CategoryPhaseConfig,
  playDays: PlayDayValues[],
  courtCount: number,
): number {
  return simulateCategorySchedule(
    confirmedPairs,
    categoryConfig,
    playDays,
    courtCount,
  ).intermediateMatches;
}

export function buildCategoryZonesGrid(params: {
  categoryConfig: CategoryPhaseConfig;
  playDays: PlayDayValues[];
  courtCount: number;
  confirmedPairsForEstimate: number;
  reservations: SlotReservationRef[];
  currentPairId: string;
  /// Si se indica, usa este total (p. ej. suma de todas las categorías).
  intermediateMatchesOverride?: number;
  /// Rangos de preferencia: no bloquea celdas de otras parejas.
  preferenceMode?: boolean;
}) {
  const { categoryConfig, playDays, courtCount } = params;
  const intermediateMatches =
    params.intermediateMatchesOverride ??
    estimateIntermediateMatches(
      params.confirmedPairsForEstimate,
      categoryConfig,
      playDays,
      courtCount,
    );
  const zonesSlotMinutes =
    categoryConfig.phases.zones.matchDurationMin + categoryConfig.intervalMin;

  return buildZonesRegistrationGrid({
    playDays,
    zonesPlayDates: categoryConfig.phases.zones.playDates,
    knockoutPlayDates: categoryConfig.phases.knockout.playDates,
    courtCount,
    zonesSlotMinutes,
    knockoutMatchDurationMin: categoryConfig.phases.knockout.matchDurationMin,
    intervalMin: categoryConfig.intervalMin,
    intermediateMatches,
    reservations: params.reservations,
    currentPairId: params.currentPairId,
    preferenceMode: params.preferenceMode ?? true,
  });
}

export function findSlotInRules(
  rules: ReturnType<typeof buildZonesRegistrationGrid>,
  playDate: string,
  courtIndex: number,
  slotIndex: number,
): CourtDaySlot | null {
  for (const day of rules) {
    if (day.playDate !== playDate) continue;
    for (const court of day.courts) {
      if (court.courtIndex !== courtIndex) continue;
      const slot = court.slots.find((s) => s.slotIndex === slotIndex);
      if (slot) return slot;
    }
  }
  return null;
}

/// Horario de preferencia (indistinto de cancha): usa cancha 0 como referencia.
export function findPreferenceSlotInRules(
  rules: ReturnType<typeof buildZonesRegistrationGrid>,
  playDate: string,
  slotIndex: number,
): CourtDaySlot | null {
  return findSlotInRules(rules, playDate, 0, slotIndex);
}

export { ZONES_SLOTS_PER_PAIR };
