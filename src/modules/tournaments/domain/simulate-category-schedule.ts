import type { CategoryPhaseConfig } from "./types";
import type {
  FinalPhaseStartRound,
  PlayDayValues,
  TournamentPhaseKey,
} from "./config-schema";
import {
  FINAL_PHASE_START_ROUND_VALUES,
  TOURNAMENT_PHASE_META,
} from "./config-schema";
import { intermediateMatchCount } from "./bracket-rounds";
import { playDayWindowMinutes } from "./play-day";

const PAIR_COUNT_BY_ROUND: Record<FinalPhaseStartRound, number> = {
  ROUND_32: 32,
  ROUND_16: 16,
  QUARTER_FINALS: 8,
  SEMI_FINALS: 4,
};

export interface PhaseScheduleSimulation {
  key: TournamentPhaseKey;
  label: string;
  matchCount: number;
  dayCount: number;
  minutesNeeded: number;
  minutesAvailable: number;
  surplusMinutes: number;
  fits: boolean;
  /// Hay partidos pero la fase no tiene días de juego asignados.
  missingPlayDates: boolean;
}

export interface CategoryScheduleSimulation {
  confirmedPairs: number;
  zoneCount: number;
  zoneSizes: number[];
  zoneMatches: number;
  advancers: number;
  bracketSize: number;
  intermediateMatches: number;
  finalMatches: number;
  totalMatches: number;
  minutesNeeded: number;
  minutesAvailable: number;
  courtCount: number;
  fits: boolean;
  surplusMinutes: number;
  phases: PhaseScheduleSimulation[];
}

/// Reparte N parejas en zonas de 3 (preferido). Si N no es múltiplo de 3,
/// aparecen zonas de 4. En el formato actual solo hay zonas de 3 o 4
/// (salvo casos chicos: 1–2, o 5 → 3+2).
export function distributeZoneSizes(
  pairCount: number,
  targetSize = 3,
): number[] {
  if (pairCount <= 0) return [];

  // Formato canónico VeloxCourt: objetivo 3, complemento 4.
  if (targetSize === 3) {
    if (pairCount < 3) return [pairCount];
    if (pairCount === 5) return [3, 2];

    const rem = pairCount % 3;
    if (rem === 0) {
      return Array.from({ length: pairCount / 3 }, () => 3);
    }
    if (rem === 1) {
      // Un 4 + resto de 3 (4, 7, 10, 13…).
      const threes = (pairCount - 4) / 3;
      return [4, ...Array.from({ length: threes }, () => 3)];
    }
    // rem === 2: dos 4 + resto de 3 (8, 11, 14…).
    const threes = (pairCount - 8) / 3;
    return [4, 4, ...Array.from({ length: threes }, () => 3)];
  }

  if (pairCount <= targetSize + 1) return [pairCount];

  let zoneCount = Math.max(1, Math.round(pairCount / targetSize));
  while (zoneCount > 1 && Math.ceil(pairCount / zoneCount) > targetSize + 1) {
    zoneCount += 1;
  }
  while (zoneCount > 1 && Math.floor(pairCount / zoneCount) < 3) {
    zoneCount -= 1;
  }

  const base = Math.floor(pairCount / zoneCount);
  const remainder = pairCount % zoneCount;
  const sizes = Array.from({ length: zoneCount }, (_, i) =>
    i < remainder ? base + 1 : base,
  );

  // Evitar zonas de 1 si hay otra zona a la que sumar.
  for (let i = 0; i < sizes.length; i++) {
    if (sizes[i] !== 1) continue;
    const donor = sizes.findIndex((s, j) => j !== i && s > 3);
    if (donor >= 0) {
      sizes[donor] -= 1;
      sizes[i] += 1;
    }
  }

  return sizes.filter((s) => s > 0);
}

function matchesForZoneSize(zoneSize: number): number {
  if (zoneSize < 2) return 0;
  if (zoneSize === 3) return 3;
  if (zoneSize === 4) return 4;
  return (zoneSize * (zoneSize - 1)) / 2;
}

function advancersFromZones(zoneSizes: number[]): number {
  return zoneSizes.reduce((sum, size) => {
    if (size >= 4) return sum + 3;
    if (size === 3) return sum + 2;
    if (size === 2) return sum + 1;
    return sum;
  }, 0);
}

function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function bracketRoundForSize(size: number): FinalPhaseStartRound | null {
  if (size >= 32) return "ROUND_32";
  if (size >= 16) return "ROUND_16";
  if (size >= 8) return "QUARTER_FINALS";
  if (size >= 4) return "SEMI_FINALS";
  return null;
}

function finalPhaseMatchCount(startsAt: FinalPhaseStartRound): number {
  return PAIR_COUNT_BY_ROUND[startsAt] - 1;
}

export function availableCourtMinutes(
  playDays: PlayDayValues[],
  courtCount: number,
): number {
  const dayMinutes = playDays.reduce(
    (sum, day) => sum + playDayWindowMinutes(day.startTime, day.endTime),
    0,
  );
  return dayMinutes * Math.max(1, courtCount);
}

function playDaysForPhase(
  playDays: PlayDayValues[],
  phaseDates: string[],
): PlayDayValues[] {
  if (phaseDates.length === 0) return [];
  const selected = new Set(phaseDates);
  return playDays.filter((day) => day.date && selected.has(day.date));
}

function uniquePlayDaysByDate(playDays: PlayDayValues[]): PlayDayValues[] {
  const seen = new Set<string>();
  const unique: PlayDayValues[] = [];
  for (const day of playDays) {
    if (!day.date || seen.has(day.date)) continue;
    seen.add(day.date);
    unique.push(day);
  }
  return unique;
}

/// Capacidad restante por fecha (minutos de cancha = ventana × canchas).
export function buildDayCapacityMap(
  playDays: PlayDayValues[],
  courtCount: number,
): Map<string, number> {
  const courts = Math.max(1, courtCount);
  const map = new Map<string, number>();
  for (const day of playDays) {
    if (!day.date) continue;
    const add =
      playDayWindowMinutes(day.startTime, day.endTime) * courts;
    map.set(day.date, (map.get(day.date) ?? 0) + add);
  }
  return map;
}

export function sumCapacityForDates(
  remaining: Map<string, number>,
  dates: string[],
): number {
  let sum = 0;
  for (const date of dates) {
    if (!date) continue;
    sum += remaining.get(date) ?? 0;
  }
  return sum;
}

/// Descuenta minutos de los días asignados. Zonas: días en orden; KO/final: desde el final.
export function consumeCapacity(
  remaining: Map<string, number>,
  dates: string[],
  needed: number,
  preferEnd: boolean,
): void {
  let left = Math.max(0, needed);
  const ordered = [...new Set(dates.filter(Boolean))].sort();
  if (preferEnd) ordered.reverse();
  for (const date of ordered) {
    if (left <= 0) break;
    const avail = remaining.get(date) ?? 0;
    const take = Math.min(avail, left);
    remaining.set(date, avail - take);
    left -= take;
  }
}

function phaseFromPool(
  key: TournamentPhaseKey,
  matchCount: number,
  durationMin: number,
  intervalMin: number,
  phaseDates: string[],
  playDays: PlayDayValues[],
  remaining: Map<string, number>,
  preferEnd: boolean,
): PhaseScheduleSimulation {
  const phasePlayDays = playDaysForPhase(playDays, phaseDates);
  const minutesNeeded = matchCount * (durationMin + intervalMin);
  const minutesAvailable = sumCapacityForDates(remaining, phaseDates);
  const surplusMinutes = minutesAvailable - minutesNeeded;
  const missingPlayDates = matchCount > 0 && phasePlayDays.length === 0;

  const phase: PhaseScheduleSimulation = {
    key,
    label: TOURNAMENT_PHASE_META[key].label,
    matchCount,
    dayCount: phasePlayDays.length,
    minutesNeeded,
    minutesAvailable,
    surplusMinutes,
    fits: !missingPlayDates && surplusMinutes >= 0,
    missingPlayDates,
  };

  // Solo consume lo que cabe: el faltante queda reflejado en fits/surplus.
  consumeCapacity(
    remaining,
    phaseDates,
    Math.min(minutesNeeded, minutesAvailable),
    preferEnd,
  );

  return phase;
}

function finalizeSimulationTotals(
  result: Omit<
    CategoryScheduleSimulation,
    "minutesNeeded" | "minutesAvailable" | "fits" | "surplusMinutes"
  > & { phases: PhaseScheduleSimulation[] },
  playDays: PlayDayValues[],
  assignedDates: string[],
  courtCount: number,
): CategoryScheduleSimulation {
  const minutesNeeded = result.phases.reduce(
    (sum, p) => sum + p.minutesNeeded,
    0,
  );
  const assignedDays = uniquePlayDaysByDate(
    playDays.filter((day) => day.date && assignedDates.includes(day.date)),
  );
  // Total disponible = unión de días (sin sumar dos veces un día compartido).
  const minutesAvailable = availableCourtMinutes(
    assignedDays.length > 0 ? assignedDays : playDays,
    courtCount,
  );
  const activePhases = result.phases.filter((p) => p.matchCount > 0);
  const fits =
    activePhases.length === 0 ? true : activePhases.every((p) => p.fits);
  const surplusMinutes = minutesAvailable - minutesNeeded;

  return {
    ...result,
    minutesNeeded,
    minutesAvailable,
    fits,
    surplusMinutes,
  };
}

function formatMinutes(total: number): string {
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function formatSimulationDuration(totalMinutes: number): string {
  return formatMinutes(totalMinutes);
}

export type SharedCategoryCapacityInput = {
  result: CategoryScheduleSimulation;
  zonesPlayDates: string[];
  knockoutPlayDates: string[];
  finalPlayDates: string[];
};

function datesIntersect(a: string[], b: string[]): boolean {
  const setB = new Set(b.filter(Boolean));
  return a.some((d) => Boolean(d) && setB.has(d));
}

function phaseDatesFor(
  input: SharedCategoryCapacityInput,
  key: TournamentPhaseKey,
): string[] {
  if (key === "zones") return input.zonesPlayDates;
  if (key === "knockout") return input.knockoutPlayDates;
  return input.finalPlayDates;
}

/// Recalcula disponibilidad con un pool único de canchas entre categorías.
/// Por fase (zonas → intermedia → final): cada categoría ve el pool de sus días
/// menos lo que necesitan las otras en fechas solapadas (reparto compartido).
/// Luego todas consumen esa fase del pool; la siguiente fase solo ve el residual.
export function applySharedCourtCapacity(
  categories: SharedCategoryCapacityInput[],
  playDays: PlayDayValues[],
  courtCount: number,
): CategoryScheduleSimulation[] {
  const remaining = buildDayCapacityMap(playDays, courtCount);
  const phaseOrder: TournamentPhaseKey[] = ["zones", "knockout", "final"];
  const preferEnd: Record<TournamentPhaseKey, boolean> = {
    zones: false,
    knockout: true,
    final: true,
  };

  const updatedPhases = categories.map(({ result }) =>
    result.phases.map((phase) => ({ ...phase })),
  );

  for (const phaseKey of phaseOrder) {
    const dateLists = categories.map((c) => phaseDatesFor(c, phaseKey));

    // 1) Snapshot simétrico: disponible = pool − necesidad de las otras categorías.
    for (let i = 0; i < categories.length; i++) {
      const myDates = dateLists[i];
      const pool = sumCapacityForDates(remaining, myDates);
      let othersNeeded = 0;
      for (let j = 0; j < categories.length; j++) {
        if (i === j) continue;
        const otherPhase = categories[j].result.phases.find(
          (p) => p.key === phaseKey,
        );
        if (!otherPhase || otherPhase.minutesNeeded <= 0) continue;
        if (datesIntersect(myDates, dateLists[j])) {
          othersNeeded += otherPhase.minutesNeeded;
        }
      }

      const minutesAvailable = Math.max(0, pool - othersNeeded);
      const phase = updatedPhases[i].find((p) => p.key === phaseKey)!;
      const surplusMinutes = minutesAvailable - phase.minutesNeeded;
      phase.minutesAvailable = minutesAvailable;
      phase.surplusMinutes = surplusMinutes;
      phase.fits = !phase.missingPlayDates && surplusMinutes >= 0;
    }

    // 2) Todas las categorías consumen esta fase del pool compartido.
    for (let i = 0; i < categories.length; i++) {
      const phase = updatedPhases[i].find((p) => p.key === phaseKey)!;
      if (phase.minutesNeeded <= 0) continue;
      const dates = dateLists[i];
      const stillThere = sumCapacityForDates(remaining, dates);
      consumeCapacity(
        remaining,
        dates,
        Math.min(phase.minutesNeeded, stillThere),
        preferEnd[phaseKey],
      );
    }
  }

  return categories.map((cat, i) => {
    const phases = updatedPhases[i];
    const minutesNeeded = phases.reduce((sum, p) => sum + p.minutesNeeded, 0);
    const assignedDates = [
      ...new Set(
        [
          ...cat.zonesPlayDates,
          ...cat.knockoutPlayDates,
          ...cat.finalPlayDates,
        ].filter(Boolean),
      ),
    ];
    const assignedDays = uniquePlayDaysByDate(
      playDays.filter((day) => day.date && assignedDates.includes(day.date)),
    );
    const unionCap = availableCourtMinutes(
      assignedDays.length > 0 ? assignedDays : playDays,
      courtCount,
    );

    // Total disponible compartido: unión de días propios − carga total de las otras
    // categorías que solapan alguno de esos días.
    let othersTotal = 0;
    for (let j = 0; j < categories.length; j++) {
      if (j === i) continue;
      const otherAssigned = [
        ...new Set(
          [
            ...categories[j].zonesPlayDates,
            ...categories[j].knockoutPlayDates,
            ...categories[j].finalPlayDates,
          ].filter(Boolean),
        ),
      ];
      if (!datesIntersect(assignedDates, otherAssigned)) continue;
      othersTotal += categories[j].result.minutesNeeded;
    }

    const minutesAvailable = Math.max(0, unionCap - othersTotal);
    const activePhases = phases.filter((p) => p.matchCount > 0);
    const fits =
      activePhases.length === 0 ? true : activePhases.every((p) => p.fits);

    return {
      ...cat.result,
      phases,
      minutesNeeded,
      minutesAvailable,
      fits,
      surplusMinutes: minutesAvailable - minutesNeeded,
    };
  });
}

/** @deprecated Usar applySharedCourtCapacity. */
export function applySharedZonesCapacity(
  result: CategoryScheduleSimulation,
  sharedZonesMinutesAvailable: number,
  otherZonesMinutesNeeded: number,
): CategoryScheduleSimulation {
  const phases = result.phases.map((phase) => {
    if (phase.key !== "zones") return phase;
    const minutesAvailable = Math.max(
      0,
      sharedZonesMinutesAvailable - otherZonesMinutesNeeded,
    );
    const surplusMinutes = minutesAvailable - phase.minutesNeeded;
    return {
      ...phase,
      minutesAvailable,
      surplusMinutes,
      fits: !phase.missingPlayDates && surplusMinutes >= 0,
    };
  });

  const minutesNeeded = phases.reduce((sum, p) => sum + p.minutesNeeded, 0);
  const nonZonesAvailable = phases
    .filter((p) => p.key !== "zones")
    .reduce((sum, p) => sum + p.minutesAvailable, 0);
  const zonesPhase = phases.find((p) => p.key === "zones");
  const minutesAvailable =
    (zonesPhase?.minutesAvailable ?? 0) + nonZonesAvailable;
  const activePhases = phases.filter((p) => p.matchCount > 0);
  const fits =
    activePhases.length === 0 ? true : activePhases.every((p) => p.fits);
  const surplusMinutes = minutesAvailable - minutesNeeded;

  return {
    ...result,
    phases,
    minutesNeeded,
    minutesAvailable,
    fits,
    surplusMinutes,
  };
}

export function playDaysForDates(
  playDays: PlayDayValues[],
  dates: string[],
): PlayDayValues[] {
  const selected = new Set(dates.filter(Boolean));
  return playDays.filter((day) => day.date && selected.has(day.date));
}

/// Simula fixture y carga horaria para una categoría con N parejas confirmadas.
/// Asume: zonas de 3 (RR) o 4 (apertura + G/G + P/P); pasan 2 o 3 según tamaño;
/// llave simple; canchas en paralelo. En días compartidos entre fases,
/// intermedia/final solo disponen del residual tras restar lo consumido por zonas
/// (y luego por KO).
export function simulateCategorySchedule(
  confirmedPairs: number,
  categoryConfig: CategoryPhaseConfig,
  playDays: PlayDayValues[],
  courtCount: number,
): CategoryScheduleSimulation {
  const pairs = Math.max(0, Math.floor(confirmedPairs));
  const courts = Math.max(1, courtCount);
  const zoneSizes = distributeZoneSizes(
    pairs,
    categoryConfig.pairsPerZone || 3,
  );
  const zoneMatches = zoneSizes.reduce(
    (sum, size) => sum + matchesForZoneSize(size),
    0,
  );
  const advancers = advancersFromZones(zoneSizes);
  const bracketSize = nextPowerOfTwo(Math.max(advancers, 1));
  const startsAt = categoryConfig.phases.final.startsAtRound;

  let intermediateMatches = 0;
  let finalMatches = 0;

  if (advancers <= 1) {
    intermediateMatches = 0;
    finalMatches = 0;
  } else if (bracketSize <= 2) {
    intermediateMatches = 0;
    finalMatches = 1;
  } else {
    const bracketRound = bracketRoundForSize(bracketSize);
    finalMatches = finalPhaseMatchCount(startsAt);

    if (bracketRound) {
      const startIdx = FINAL_PHASE_START_ROUND_VALUES.indexOf(bracketRound);
      const finalIdx = FINAL_PHASE_START_ROUND_VALUES.indexOf(startsAt);
      if (startIdx >= 0 && finalIdx > startIdx) {
        intermediateMatches = intermediateMatchCount(startsAt, bracketRound);
      } else if (startIdx >= 0 && finalIdx <= startIdx) {
        // La llave empieza en o después del inicio de la final: todo es fase final.
        intermediateMatches = 0;
        finalMatches = bracketSize - 1;
      }
    } else {
      intermediateMatches = 0;
      finalMatches = Math.max(0, bracketSize - 1);
    }

    // No inventar más partidos de los que permite la llave.
    const knockoutCap = Math.max(0, bracketSize - 1);
    if (intermediateMatches + finalMatches > knockoutCap) {
      intermediateMatches = Math.max(0, knockoutCap - finalMatches);
    }
  }

  const { zones, knockout, final } = categoryConfig.phases;
  const interval = categoryConfig.intervalMin;
  const remaining = buildDayCapacityMap(playDays, courts);

  const phases: PhaseScheduleSimulation[] = [
    phaseFromPool(
      "zones",
      zoneMatches,
      zones.matchDurationMin,
      interval,
      zones.playDates,
      playDays,
      remaining,
      false,
    ),
    phaseFromPool(
      "knockout",
      intermediateMatches,
      knockout.matchDurationMin,
      interval,
      knockout.playDates,
      playDays,
      remaining,
      true,
    ),
    phaseFromPool(
      "final",
      finalMatches,
      final.matchDurationMin,
      interval,
      final.playDates,
      playDays,
      remaining,
      true,
    ),
  ];

  return finalizeSimulationTotals(
    {
      confirmedPairs: pairs,
      zoneCount: zoneSizes.length,
      zoneSizes,
      zoneMatches,
      advancers,
      bracketSize: advancers <= 1 ? 0 : bracketSize,
      intermediateMatches,
      finalMatches,
      totalMatches: zoneMatches + intermediateMatches + finalMatches,
      courtCount: courts,
      phases,
    },
    playDays,
    [...zones.playDates, ...knockout.playDates, ...final.playDates],
    courts,
  );
}
