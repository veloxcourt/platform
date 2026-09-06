import {
  minutesToTime,
  timeToMinutes,
  closingMinutes,
} from "@/modules/bookings/domain/rules";
import {
  BRACKET_ROUND_VALUES,
  TOURNAMENT_PHASE_META,
} from "./config-schema";
import type { BracketRound, PlayDayValues } from "./config-schema";
import {
  categoryInstanceLoads,
  gcdOf,
  slotStepMinutes,
} from "./instance-slot-config";
import { playDayTimelineMinutes, playDayWindowMinutes } from "./play-day";
import {
  buildPlayDayRulerSlots,
  playDayRulerSelectedMinutes,
} from "./play-day-slots";
import type { CategoryScheduleSimulation } from "./simulate-category-schedule";
import type { CategoryPhaseConfig } from "./types";

/// Con pairsPerZone = 3, cada pareja juega 2 partidos en zonas (fixture).
/// Las preferencias de inscripción no usan este tope: se marcan todos los rangos posibles.
export const ZONES_SLOTS_PER_PAIR = 2;

export type SlotCellStatus =
  | "free"
  | "projected"
  | "blocked"
  | "reserved"
  | "mine";

export type SlotBlockReason = "knockout" | "final";

export type SimulationPhaseKey = "zones" | "knockout" | "final";

export interface CourtDaySlot {
  id: string;
  playDate: string;
  courtIndex: number;
  slotIndex: number;
  startTime: string;
  endTime: string;
  status: SlotCellStatus;
  blockReason?: SlotBlockReason;
  pairId?: string | null;
  pairLabel?: string | null;
  /// Solo en modo simulación: fase proyectada en esta celda.
  projectedPhase?: SimulationPhaseKey;
  /// En simulación: si la celda la ocupó otra categoría (mismas canchas físicas).
  projectedSource?: "self" | "other";
  /// En simulación: categoría que ocupa la celda (para color y leyenda).
  projectedCategoryId?: string;
  /// Partido que ocupa más de una celda (60 en grilla de 30, 90, etc.).
  spanCells?: number;
  /// true = celda de continuación; no cuenta como partido extra.
  spanContinuation?: boolean;
  /// Duración real del partido o del hueco libre (para el ancho visual).
  durationMinutes?: number;
  /// Partido real: código corto, ej. A1.
  matchCode?: string | null;
  /// Más de uno = choque de categorías en la misma cancha/hora.
  occupants?: {
    categoryId: string;
    matchCode?: string | null;
    pair1Label?: string | null;
    pair2Label?: string | null;
  }[];
  /// Parejas que ya marcaron este horario (preferencia, indistinto de cancha).
  preferenceCount?: number;
  /// Canchas en paralelo: tope visual de saturación.
  courtCapacity?: number;
}

export type PreferenceDensityLevel = "empty" | "low" | "mid" | "full";

export function preferenceDensityLevel(
  count: number,
  capacity: number,
): PreferenceDensityLevel {
  if (count <= 0) return "empty";
  const ratio = count / Math.max(1, capacity);
  if (ratio >= 1) return "full";
  if (ratio >= 0.5) return "mid";
  return "low";
}

export function preferenceDensityLabel(
  count: number,
  capacity: number,
): string {
  const cap = Math.max(1, capacity);
  switch (preferenceDensityLevel(count, cap)) {
    case "empty":
      return "Libre";
    case "low":
      return `Poco pedido (${count}/${cap})`;
    case "mid":
      return `Pedido (${count}/${cap})`;
    case "full":
      return `Saturado (${count}/${cap})`;
  }
}

export interface SlotReservationRef {
  pairId: string;
  pairLabel: string;
  playDate: string;
  courtIndex: number;
  slotIndex: number;
}

export interface CourtDayRule {
  playDate: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  /// Duración de cada celda en este día (puede cambiar si la fase es distinta).
  slotMinutes?: number;
  /// Duraciones reales de partido en este día (60 y 90, etc.).
  matchDurations?: number[];
  courts: {
    courtIndex: number;
    courtLabel: string;
    slots: CourtDaySlot[];
  }[];
}

/// Un partido de 60 min = el cuadrado actual (w-16). El resto escala.
export const MATCH_SLOT_UNIT_MIN = 60;
export const MATCH_SLOT_UNIT_REM = 4;

export function slotDurationMinutes(slot: Pick<CourtDaySlot, "startTime" | "endTime" | "durationMinutes">): number {
  if (slot.durationMinutes && slot.durationMinutes > 0) return slot.durationMinutes;
  return slotLengthMinutes(slot as CourtDaySlot);
}

export function slotBoxWidthRem(durationMinutes: number): number {
  return (Math.max(1, durationMinutes) / MATCH_SLOT_UNIT_MIN) * MATCH_SLOT_UNIT_REM;
}

function slotId(playDate: string, courtIndex: number, slotIndex: number) {
  return `${playDate}:${courtIndex}:${slotIndex}`;
}

function displayTime(absoluteMin: number): string {
  return minutesToTime(absoluteMin % (24 * 60));
}

/// Genera slots vacíos (status free) para un día × canchas.
export function buildEmptyCourtDaySlots(
  playDay: PlayDayValues,
  courtCount: number,
  slotMinutes: number,
): CourtDaySlot[] {
  if (!playDay.date || slotMinutes <= 0) return [];
  const courts = Math.max(1, courtCount);
  const slots: CourtDaySlot[] = [];

  if (playDay.hasSlotSelection) {
    const ruler = buildPlayDayRulerSlots(
      playDay.startTime,
      playDay.overnightExtraSlots ?? 0,
      slotMinutes,
    );
    const enabled = new Set(playDay.enabledSlotIndexes ?? []);
    if (enabled.size === 0) return [];

    for (let courtIndex = 0; courtIndex < courts; courtIndex++) {
      for (const tick of ruler) {
        if (!enabled.has(tick.slotIndex)) continue;
        slots.push({
          id: slotId(playDay.date, courtIndex, tick.slotIndex),
          playDate: playDay.date,
          courtIndex,
          slotIndex: tick.slotIndex,
          startTime: tick.startTime,
          endTime: tick.endTime,
          status: "free",
        });
      }
    }
    return slots;
  }

  const start = timeToMinutes(playDay.startTime);
  const end = closingMinutes(playDay.startTime, playDay.endTime);
  const window = end - start;
  const slotsPerCourt = Math.floor(window / slotMinutes);
  if (slotsPerCourt <= 0) return [];

  for (let courtIndex = 0; courtIndex < courts; courtIndex++) {
    for (let slotIndex = 0; slotIndex < slotsPerCourt; slotIndex++) {
      const slotStart = start + slotIndex * slotMinutes;
      const slotEnd = slotStart + slotMinutes;
      slots.push({
        id: slotId(playDay.date, courtIndex, slotIndex),
        playDate: playDay.date,
        courtIndex,
        slotIndex,
        startTime: displayTime(slotStart),
        endTime: displayTime(slotEnd),
        status: "free",
      });
    }
  }

  return slots;
}

function groupSlotsIntoRules(
  playDays: PlayDayValues[],
  slots: CourtDaySlot[],
  courtCount: number,
  slotMinutesByDate?: Map<string, number>,
): CourtDayRule[] {
  const byDate = new Map<string, CourtDaySlot[]>();
  for (const slot of slots) {
    const list = byDate.get(slot.playDate) ?? [];
    list.push(slot);
    byDate.set(slot.playDate, list);
  }

  const courts = Math.max(1, courtCount);
  return playDays
    .filter((d) => d.date && byDate.has(d.date))
    .map((day, dayIndex) => {
      const daySlots = byDate.get(day.date) ?? [];
      return {
        playDate: day.date,
        dayLabel: `Día ${dayIndex + 1}`,
        startTime: day.startTime,
        endTime: day.endTime,
        slotMinutes: slotMinutesByDate?.get(day.date),
        courts: Array.from({ length: courts }, (_, courtIndex) => ({
          courtIndex,
          courtLabel: `Cancha ${courtIndex + 1}`,
          slots: daySlots
            .filter((s) => s.courtIndex === courtIndex)
            .sort(
              (a, b) =>
                playDayTimelineMinutes(a.startTime, day.startTime) -
                playDayTimelineMinutes(b.startTime, day.startTime),
            ),
        })),
      };
    });
}

/// Marca como blocked (desde el final del día) las celdas necesarias para
/// consumir `blockMinutes` de capacidad de cancha en ese día.
export function applyTrailingBlock(
  slots: CourtDaySlot[],
  playDate: string,
  courtCount: number,
  slotMinutes: number,
  blockMinutes: number,
  reason: SlotBlockReason,
): void {
  if (blockMinutes <= 0 || slotMinutes <= 0) return;

  const daySlots = slots.filter((s) => s.playDate === playDate);
  if (daySlots.length === 0) return;

  const slotsPerCourt = Math.max(
    ...daySlots.map((s) => s.slotIndex + 1),
    0,
  );
  const courts = Math.max(1, courtCount);
  const cellsNeeded = Math.ceil(blockMinutes / slotMinutes);
  let remaining = cellsNeeded;

  // Desde el final del día hacia atrás, repartiendo entre canchas.
  for (let slotIndex = slotsPerCourt - 1; slotIndex >= 0 && remaining > 0; slotIndex--) {
    for (let courtIndex = courts - 1; courtIndex >= 0 && remaining > 0; courtIndex--) {
      const slot = daySlots.find(
        (s) => s.courtIndex === courtIndex && s.slotIndex === slotIndex,
      );
      if (!slot || slot.status !== "free") continue;
      slot.status = "blocked";
      slot.blockReason = reason;
      remaining -= 1;
    }
  }
}

function slotTimelineCmp(a: CourtDaySlot, b: CourtDaySlot): number {
  const dateCmp = a.playDate.localeCompare(b.playDate);
  if (dateCmp !== 0) return dateCmp;
  if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
  return a.courtIndex - b.courtIndex;
}

/** Corte temporal: el partido siguiente debe empezar en un slotIndex posterior (mismas canchas en paralelo a la misma hora). */
function isStrictlyAfterCutoff(
  slot: CourtDaySlot,
  cutoff: { playDate: string; slotIndex: number } | null,
): boolean {
  if (!cutoff) return true;
  const dateCmp = slot.playDate.localeCompare(cutoff.playDate);
  if (dateCmp !== 0) return dateCmp > 0;
  return slot.slotIndex > cutoff.slotIndex;
}

function latestProjectedCutoff(
  slots: CourtDaySlot[],
  phases: SimulationPhaseKey[],
): { playDate: string; slotIndex: number } | null {
  let best: CourtDaySlot | null = null;
  for (const slot of slots) {
    if (slot.status !== "projected" || !slot.projectedPhase) continue;
    if (!phases.includes(slot.projectedPhase)) continue;
    if (!best || slotTimelineCmp(slot, best) > 0) best = slot;
  }
  return best
    ? { playDate: best.playDate, slotIndex: best.slotIndex }
    : null;
}

/**
 * Orden de llenado: día → horario → cancha.
 * Así a la misma hora se usan todas las canchas antes de pasar al siguiente horario.
 */
function freeSlotsForDates(
  slots: CourtDaySlot[],
  playDates: string[],
  afterCutoff: { playDate: string; slotIndex: number } | null = null,
): CourtDaySlot[] {
  const dateSet = new Set(playDates.filter(Boolean));
  return slots
    .filter(
      (s) =>
        dateSet.has(s.playDate) &&
        s.status === "free" &&
        !s.blockReason &&
        isStrictlyAfterCutoff(s, afterCutoff),
    )
    .sort(slotTimelineCmp);
}

interface PhaseLoad {
  playDates: string[];
  matchCount: number;
  matchDurations?: number[];
  source: "self" | "other";
  categoryId?: string;
}

function slotLengthMinutes(slot: CourtDaySlot): number {
  const start = timeToMinutes(slot.startTime);
  let end = timeToMinutes(slot.endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(1, end - start);
}

function consecutiveFreeOnCourt(
  slots: CourtDaySlot[],
  start: CourtDaySlot,
  cellsNeeded: number,
): CourtDaySlot[] | null {
  const block = slots
    .filter(
      (slot) =>
        slot.playDate === start.playDate &&
        slot.courtIndex === start.courtIndex &&
        slot.slotIndex >= start.slotIndex &&
        slot.slotIndex < start.slotIndex + cellsNeeded,
    )
    .sort((a, b) => a.slotIndex - b.slotIndex);
  if (block.length < cellsNeeded) return null;
  if (block.some((slot) => slot.status !== "free" || slot.blockReason)) {
    return null;
  }
  return block;
}

function markProjectedBlock(
  block: CourtDaySlot[],
  phase: SimulationPhaseKey,
  source: "self" | "other",
  categoryId?: string,
  durationMinutes?: number,
) {
  const lead = block[0];
  const last = block[block.length - 1];
  for (let index = 0; index < block.length; index++) {
    const slot = block[index];
    if (!slot) continue;
    slot.status = "projected";
    slot.projectedPhase = phase;
    slot.projectedSource = source;
    slot.projectedCategoryId = categoryId;
    slot.spanContinuation = index > 0;
    if (index === 0 && lead) {
      slot.spanCells = block.length;
      slot.durationMinutes =
        durationMinutes && durationMinutes > 0
          ? durationMinutes
          : block.reduce((sum, cell) => sum + slotLengthMinutes(cell), 0);
      if (last) slot.endTime = last.endTime;
    }
  }
}

function sameDisplayGroup(a: CourtDaySlot, b: CourtDaySlot): boolean {
  return (
    a.status === b.status &&
    a.blockReason === b.blockReason &&
    a.projectedPhase === b.projectedPhase &&
    a.projectedCategoryId === b.projectedCategoryId &&
    a.projectedSource === b.projectedSource
  );
}

/// Una caja = un partido (o un hueco libre). 60 min = cuadrado actual.
export function collapseCourtSlotsToMatches(
  slots: CourtDaySlot[],
  cellMinutes: number,
  visualUnit = MATCH_SLOT_UNIT_MIN,
): CourtDaySlot[] {
  const sorted = [...slots].sort((a, b) => a.slotIndex - b.slotIndex);
  const out: CourtDaySlot[] = [];
  let index = 0;
  while (index < sorted.length) {
    const slot = sorted[index];
    if (!slot) break;
    if (slot.spanContinuation) {
      index += 1;
      continue;
    }
    if (slot.status === "projected") {
      const cells = Math.max(1, slot.spanCells ?? 1);
      const block = sorted.slice(index, index + cells);
      const last = block[block.length - 1] ?? slot;
      const duration =
        slot.durationMinutes && slot.durationMinutes > 0
          ? slot.durationMinutes
          : block.reduce((sum, cell) => sum + slotLengthMinutes(cell), 0);
      out.push({
        ...slot,
        spanCells: 1,
        spanContinuation: false,
        durationMinutes: duration,
        endTime: last.endTime,
      });
      index += cells;
      continue;
    }
    const group = [slot];
    let minutes = slotLengthMinutes(slot);
    while (minutes < visualUnit && index + group.length < sorted.length) {
      const next = sorted[index + group.length];
      if (!next || next.status === "projected" || next.spanContinuation) break;
      if (!sameDisplayGroup(slot, next)) break;
      group.push(next);
      minutes += slotLengthMinutes(next);
      if (minutes >= visualUnit) break;
    }
    const last = group[group.length - 1] ?? slot;
    out.push({
      ...slot,
      durationMinutes: minutes || cellMinutes,
      endTime: last.endTime,
    });
    index += group.length;
  }
  return out;
}

function collapseRulesToMatches(
  rules: CourtDayRule[],
  cellMinutesByDate: Map<string, number>,
): CourtDayRule[] {
  return rules.map((rule) => {
    const cellMinutes =
      cellMinutesByDate.get(rule.playDate) ??
      rule.slotMinutes ??
      MATCH_SLOT_UNIT_MIN;
    return {
      ...rule,
      courts: rule.courts.map((court) => ({
        ...court,
        slots: collapseCourtSlotsToMatches(court.slots, cellMinutes),
      })),
    };
  });
}

/// Coloca partidos intercalados (A, B, A, B…) llenando canchas en paralelo por horario.
function packInterleavedProjectedMatches(
  slots: CourtDaySlot[],
  loads: PhaseLoad[],
  phase: SimulationPhaseKey,
  afterCutoff: { playDate: string; slotIndex: number } | null = null,
): void {
  const remaining = loads
    .filter((l) => l.matchCount > 0 && l.playDates.length > 0)
    .map((l) => ({
      ...l,
      dateSet: new Set(l.playDates.filter(Boolean)),
      durations: l.matchDurations?.slice() ?? [],
      left: l.matchCount,
    }));
  if (remaining.length === 0) return;

  const allDates = [...new Set(remaining.flatMap((l) => [...l.dateSet]))];
  const ordered = freeSlotsForDates(slots, allDates, afterCutoff);

  let cursor = 0;
  for (const slot of ordered) {
    if (slot.status !== "free") continue;
    if (remaining.every((l) => l.left <= 0)) break;

    const n = remaining.length;
    let chosen: (typeof remaining)[number] | null = null;
    for (let offset = 0; offset < n; offset++) {
      const load = remaining[(cursor + offset) % n];
      if (load.left > 0 && load.dateSet.has(slot.playDate)) {
        chosen = load;
        cursor = (cursor + offset + 1) % n;
        break;
      }
    }
    if (!chosen) continue;

    const duration = chosen.durations.shift() ?? slotLengthMinutes(slot);
    const cellsNeeded = Math.max(
      1,
      Math.ceil(duration / slotLengthMinutes(slot)),
    );
    const block = consecutiveFreeOnCourt(slots, slot, cellsNeeded);
    if (!block) {
      if (duration > 0) chosen.durations.unshift(duration);
      continue;
    }

    markProjectedBlock(
      block,
      phase,
      chosen.source,
      chosen.categoryId,
      duration,
    );
    chosen.left -= 1;
  }
}

export function knockoutBlockMinutesForSharedDays(
  intermediateMatches: number,
  knockoutMatchDurationMin: number,
  intervalMin: number,
  sharedDayCount: number,
): number {
  if (intermediateMatches <= 0 || sharedDayCount <= 0) return 0;
  const total =
    intermediateMatches * (knockoutMatchDurationMin + intervalMin);
  // Reparte el bloqueo entre los días compartidos (ceil por día).
  return Math.ceil(total / sharedDayCount);
}

export interface BuildZonesRegistrationGridInput {
  playDays: PlayDayValues[];
  zonesPlayDates: string[];
  knockoutPlayDates: string[];
  courtCount: number;
  zonesSlotMinutes: number;
  knockoutMatchDurationMin: number;
  intervalMin: number;
  intermediateMatches: number;
  reservations?: SlotReservationRef[];
  currentPairId?: string | null;
  /// Preferencias: otras parejas no bloquean celdas (solo se marcan las de currentPairId).
  preferenceMode?: boolean;
}

/// Grilla de inscripción: solo días de zonas; bloquea tramo intermedia en días compartidos.
export function buildZonesRegistrationGrid(
  input: BuildZonesRegistrationGridInput,
): CourtDayRule[] {
  const zonesDates = new Set(input.zonesPlayDates.filter(Boolean));
  const knockoutDates = new Set(input.knockoutPlayDates.filter(Boolean));
  const zonesDays = input.playDays.filter((d) => d.date && zonesDates.has(d.date));
  const sharedDates = [...zonesDates].filter((d) => knockoutDates.has(d));

  const slots: CourtDaySlot[] = [];
  for (const day of zonesDays) {
    slots.push(
      ...buildEmptyCourtDaySlots(
        day,
        input.courtCount,
        input.zonesSlotMinutes,
      ),
    );
  }

  const blockPerSharedDay = knockoutBlockMinutesForSharedDays(
    input.intermediateMatches,
    input.knockoutMatchDurationMin,
    input.intervalMin,
    sharedDates.length,
  );

  for (const date of sharedDates) {
    applyTrailingBlock(
      slots,
      date,
      input.courtCount,
      input.zonesSlotMinutes,
      blockPerSharedDay,
      "knockout",
    );
  }

  applyReservations(
    slots,
    input.reservations ?? [],
    input.currentPairId,
    input.preferenceMode === true,
    input.courtCount,
  );

  // Re-numerar labels Día N según orden de playDays del torneo (no solo zonas).
  const labeledDays = input.playDays
    .map((d, i) => ({ date: d.date, label: `Día ${i + 1}`, day: d }))
    .filter((d) => d.date && zonesDates.has(d.date));

  const rules = groupSlotsIntoRules(
    labeledDays.map((d) => d.day),
    slots,
    input.courtCount,
  );

  const labelByDate = new Map(labeledDays.map((d) => [d.date, d.label]));
  for (const rule of rules) {
    rule.dayLabel = labelByDate.get(rule.playDate) ?? rule.dayLabel;
  }

  return rules;
}

export type SimulationRoundLoad = {
  key?: BracketRound;
  playDates: string[];
  slotMinutes: number;
  matchCount: number;
};

export function isProjectedMatchLead(slot: CourtDaySlot): boolean {
  return slot.status === "projected" && slot.spanContinuation !== true;
}

export function formatDaySlotLabel(day: Pick<CourtDayRule, "slotMinutes" | "matchDurations">): string | null {
  const unique = [...new Set(day.matchDurations?.filter((value) => value > 0) ?? [])]
    .sort((a, b) => a - b);
  if (unique.length > 1) return `${unique.join(" y ")} min`;
  if (unique.length === 1) return `slots de ${unique[0]} min`;
  if (day.slotMinutes) return `slots de ${day.slotMinutes} min`;
  return null;
}

export function simulationRoundsFromCategory(
  config: CategoryPhaseConfig,
  pairCount: number,
): {
  knockoutRounds: SimulationRoundLoad[];
  finalRounds: SimulationRoundLoad[];
} {
  const loads = categoryInstanceLoads(config, pairCount);
  return {
    knockoutRounds: loads
      .filter((load) => load.phase === "knockout")
      .map((load) => ({
        key: load.key,
        playDates: load.playDates,
        slotMinutes: load.slotMinutes,
        matchCount: load.matchCount,
      })),
    finalRounds: loads
      .filter((load) => load.phase === "final")
      .map((load) => ({
        key: load.key,
        playDates: load.playDates,
        slotMinutes: load.slotMinutes,
        matchCount: load.matchCount,
      })),
  };
}

export function toSimulationCategoryLoad(
  categoryId: string,
  config: CategoryPhaseConfig,
  pairCount: number,
  matches: { zone: number; intermediate: number; final: number },
): SimulationCategoryLoad {
  const rounds = simulationRoundsFromCategory(config, pairCount);
  const knockoutDates = [
    ...new Set(rounds.knockoutRounds.flatMap((round) => round.playDates)),
  ];
  const finalDates = [
    ...new Set(rounds.finalRounds.flatMap((round) => round.playDates)),
  ];
  return {
    categoryId,
    zonesPlayDates: config.phases.zones.playDates,
    knockoutPlayDates:
      knockoutDates.length > 0
        ? knockoutDates
        : config.phases.knockout.playDates,
    finalPlayDates:
      finalDates.length > 0 ? finalDates : config.phases.final.playDates,
    zoneMatches: matches.zone,
    intermediateMatches: matches.intermediate,
    finalMatches: matches.final,
    zonesSlotMinutes:
      config.phases.zones.matchDurationMin + config.intervalMin,
    knockoutSlotMinutes:
      config.phases.knockout.matchDurationMin + config.intervalMin,
    finalSlotMinutes:
      config.phases.final.matchDurationMin + config.intervalMin,
    ...rounds,
  };
}

export interface SimulationCategoryLoad {
  categoryId: string;
  zonesPlayDates: string[];
  knockoutPlayDates: string[];
  finalPlayDates: string[];
  zoneMatches: number;
  intermediateMatches: number;
  finalMatches: number;
  zonesSlotMinutes?: number;
  knockoutSlotMinutes?: number;
  finalSlotMinutes?: number;
  knockoutRounds?: SimulationRoundLoad[];
  finalRounds?: SimulationRoundLoad[];
}

type SimulationDateLoad = Pick<
  SimulationCategoryLoad,
  | "zonesPlayDates"
  | "knockoutPlayDates"
  | "finalPlayDates"
  | "zonesSlotMinutes"
  | "knockoutSlotMinutes"
  | "finalSlotMinutes"
  | "knockoutRounds"
  | "finalRounds"
>;

export function slotSizesForSimulationDate(
  playDate: string,
  loads: SimulationDateLoad[],
  fallback?: number,
): number[] {
  const sizes: number[] = [];
  for (const load of loads) {
    if (load.zonesPlayDates.includes(playDate) && load.zonesSlotMinutes) {
      sizes.push(load.zonesSlotMinutes);
    }
    if (load.knockoutRounds && load.knockoutRounds.length > 0) {
      for (const round of load.knockoutRounds) {
        if (
          round.matchCount > 0 &&
          round.playDates.includes(playDate) &&
          round.slotMinutes > 0
        ) {
          sizes.push(round.slotMinutes);
        }
      }
    } else if (load.knockoutPlayDates.includes(playDate)) {
      sizes.push(load.knockoutSlotMinutes ?? fallback ?? 0);
    }
    if (load.finalRounds && load.finalRounds.length > 0) {
      for (const round of load.finalRounds) {
        if (
          round.matchCount > 0 &&
          round.playDates.includes(playDate) &&
          round.slotMinutes > 0
        ) {
          sizes.push(round.slotMinutes);
        }
      }
    } else if (load.finalPlayDates.includes(playDate)) {
      sizes.push(load.finalSlotMinutes ?? fallback ?? 0);
    }
  }
  return sizes.filter((value) => value > 0);
}

export function matchDurationsForSimulationDate(
  playDate: string,
  loads: SimulationDateLoad[],
  fallback?: number,
): number[] {
  return [...new Set(slotSizesForSimulationDate(playDate, loads, fallback))].sort(
    (a, b) => a - b,
  );
}

export function slotMinutesForSimulationDate(
  playDate: string,
  loads: SimulationDateLoad[],
  fallback: number,
): number {
  const sizes = slotSizesForSimulationDate(playDate, loads, fallback);
  return slotStepMinutes(sizes, fallback);
}

export interface BuildSimulationRuleGridInput {
  playDays: PlayDayValues[];
  courtCount: number;
  zonesSlotMinutes: number;
  /// Todas las categorías en simulación (misma pool de canchas).
  categoryLoads: SimulationCategoryLoad[];
  /// Categoría desde la que se mira la grilla (self vs other).
  /// Sin valor: simulación integral, todas las categorías son propias.
  currentCategoryId?: string;
}

export type ScheduledMatchMark = {
  categoryId: string;
  playDate: string;
  startTime: string;
  courtIndex: number | null;
  slotIndex?: number | null;
  pairLabel?: string | null;
  matchCode?: string | null;
  pair1Label?: string | null;
  pair2Label?: string | null;
  projectedPhase?: SimulationPhaseKey;
  durationMinutes?: number;
};

/// Grilla de partidos reales (Regla de Partidos): pinta el slot donde quedó cada partido.
/// Solo días con fase de zonas; el rótulo Día N sigue el orden de playDays del torneo.
export function buildMatchesRuleGrid(input: {
  playDays: PlayDayValues[];
  courtCount: number;
  defaultSlotMinutes: number;
  slotMinutesByDate?: Record<string, number>;
  matches: ScheduledMatchMark[];
  zonesPlayDates?: string[];
}): CourtDayRule[] {
  const fallback = Math.max(1, input.defaultSlotMinutes);
  const slotMinutesByDate = new Map<string, number>();
  const packMinutesByDate = new Map<string, number>();
  const slots: CourtDaySlot[] = [];
  const zonesDates = new Set(
    (input.zonesPlayDates ?? input.playDays.map((day) => day.date)).filter(
      Boolean,
    ),
  );

  for (const day of input.playDays) {
    if (!day.date || !zonesDates.has(day.date)) continue;
    const visualMinutes = Math.max(
      1,
      input.slotMinutesByDate?.[day.date] ?? fallback,
    );
    const dayDurations = input.matches
      .filter((match) => match.playDate === day.date && match.durationMinutes)
      .map((match) => match.durationMinutes as number);
    const packMinutes = gcdOf([
      ...dayDurations,
      visualMinutes,
      MATCH_SLOT_UNIT_MIN,
    ]);
    slotMinutesByDate.set(day.date, visualMinutes);
    packMinutesByDate.set(day.date, packMinutes);
    slots.push(
      ...buildEmptyCourtDaySlots(
        { ...day, hasSlotSelection: false },
        input.courtCount,
        packMinutes,
      ),
    );
  }

  const byKey = new Map(
    slots.map((slot) => [
      `${slot.playDate}:${slot.courtIndex}:${slot.slotIndex}`,
      slot,
    ]),
  );
  const byTime = new Map(
    slots.map((slot) => [
      `${slot.playDate}:${slot.courtIndex}:${slot.startTime}`,
      slot,
    ]),
  );

  for (const match of input.matches) {
    if (!match.playDate || match.courtIndex == null) continue;
    const timeKey = match.startTime
      ? `${match.playDate}:${match.courtIndex}:${match.startTime}`
      : "";
    let slot = match.startTime ? byTime.get(timeKey) : undefined;
    if (!slot && match.startTime) {
      const minutes =
        match.durationMinutes ??
        packMinutesByDate.get(match.playDate) ??
        fallback;
      const startMin = timeToMinutes(match.startTime);
      slot = {
        id: `${match.playDate}:${match.courtIndex}:manual:${match.startTime}`,
        playDate: match.playDate,
        courtIndex: match.courtIndex,
        slotIndex: startMin,
        startTime: match.startTime,
        endTime: displayTime(startMin + minutes),
        status: "free",
        durationMinutes: minutes,
      };
      slots.push(slot);
      byTime.set(timeKey, slot);
    }
    if (!slot && match.slotIndex != null) {
      slot = byKey.get(
        `${match.playDate}:${match.courtIndex}:${match.slotIndex}`,
      );
    }
    if (!slot) continue;
    const cellMinutes = packMinutesByDate.get(match.playDate) ?? fallback;
    const duration = match.durationMinutes ?? cellMinutes;
    const cellsNeeded = Math.max(1, Math.ceil(duration / cellMinutes));
    const block =
      consecutiveSlotsOnCourt(slots, slot, cellsNeeded) ?? [slot];
    paintMatchBlock(block, match, duration);
  }

  const rules = collapseRulesToMatches(
    groupSlotsIntoRules(
      input.playDays,
      slots,
      input.courtCount,
      slotMinutesByDate,
    ),
    packMinutesByDate,
  );
  const labelByDate = new Map(
    input.playDays
      .filter((day) => day.date)
      .map((day, index) => [day.date, `Día ${index + 1}`] as const),
  );
  const durationsByDate = new Map<string, number[]>();
  for (const match of input.matches) {
    if (!match.playDate || !match.durationMinutes) continue;
    const list = durationsByDate.get(match.playDate) ?? [];
    list.push(match.durationMinutes);
    durationsByDate.set(match.playDate, list);
  }
  for (const rule of rules) {
    rule.dayLabel = labelByDate.get(rule.playDate) ?? rule.dayLabel;
    const fromMatches = durationsByDate.get(rule.playDate) ?? [];
    const unique = [...new Set(fromMatches.filter((value) => value > 0))].sort(
      (a, b) => a - b,
    );
    rule.matchDurations =
      unique.length > 0
        ? unique
        : rule.slotMinutes
          ? [rule.slotMinutes]
          : undefined;
  }
  return rules;
}

function consecutiveSlotsOnCourt(
  slots: CourtDaySlot[],
  start: CourtDaySlot,
  cellsNeeded: number,
): CourtDaySlot[] | null {
  const block = slots
    .filter(
      (slot) =>
        slot.playDate === start.playDate &&
        slot.courtIndex === start.courtIndex &&
        slot.slotIndex >= start.slotIndex &&
        slot.slotIndex < start.slotIndex + cellsNeeded,
    )
    .sort((a, b) => a.slotIndex - b.slotIndex);
  if (block.length < cellsNeeded) return null;
  return block;
}

function paintMatchBlock(
  block: CourtDaySlot[],
  match: ScheduledMatchMark,
  _durationMinutes: number,
) {
  const occupant = {
    categoryId: match.categoryId,
    matchCode: match.matchCode ?? null,
    pair1Label: match.pair1Label ?? null,
    pair2Label: match.pair2Label ?? null,
  };
  for (let index = 0; index < block.length; index++) {
    const slot = block[index];
    if (!slot) continue;
    slot.status = "projected";
    slot.projectedPhase = match.projectedPhase ?? "zones";
    slot.projectedSource = "self";
    slot.spanContinuation = index > 0;
    if (index === 0) {
      slot.spanCells = block.length;
      slot.durationMinutes =
        _durationMinutes > 0
          ? _durationMinutes
          : block.reduce((sum, cell) => sum + slotLengthMinutes(cell), 0);
      const last = block[block.length - 1];
      if (last) slot.endTime = last.endTime;
    }
    const occupants = slot.occupants ?? [];
    if (
      !occupants.some(
        (item) =>
          item.categoryId === occupant.categoryId &&
          item.matchCode === occupant.matchCode,
      )
    ) {
      occupants.push(occupant);
    }
    slot.occupants = occupants;
    if (!slot.projectedCategoryId) {
      slot.projectedCategoryId = match.categoryId;
      if (match.pairLabel) slot.pairLabel = match.pairLabel;
      if (match.matchCode) slot.matchCode = match.matchCode;
    }
    if (occupants.length > 1 && !slot.matchCode && match.matchCode) {
      slot.matchCode = match.matchCode;
    }
  }
}

/// Mete horarios manuales (ej. 11:20) que no caen en la regla de 30/60 min.
export function insertOffGridSlotsIntoRules(
  rules: CourtDayRule[],
  extras: Array<{
    playDate?: string | null;
    startTime?: string | null;
    courtIndex?: number | null;
  }>,
): CourtDayRule[] {
  const pending = extras.filter(
    (item): item is {
      playDate: string;
      startTime: string;
      courtIndex: number;
    } =>
      Boolean(item.playDate?.trim() && item.startTime?.trim()) &&
      item.courtIndex != null,
  );
  if (pending.length === 0) return rules;

  return rules.map((rule) => ({
    ...rule,
    courts: rule.courts.map((court) => {
      let slots = court.slots;
      for (const extra of pending) {
        if (extra.playDate !== rule.playDate) continue;
        if (extra.courtIndex !== court.courtIndex) continue;
        if (slots.some((slot) => slot.startTime === extra.startTime)) continue;
        const minutes = Math.max(1, rule.slotMinutes ?? 30);
        const startMin = timeToMinutes(extra.startTime);
        slots = [
          ...slots,
          {
            id: `${rule.playDate}:${court.courtIndex}:manual:${extra.startTime}`,
            playDate: rule.playDate,
            courtIndex: court.courtIndex,
            slotIndex: startMin,
            startTime: extra.startTime,
            endTime: displayTime(startMin + minutes),
            status: "free",
          },
        ];
      }
      return {
        ...court,
        slots: [...slots].sort(
          (a, b) =>
            playDayTimelineMinutes(a.startTime, rule.startTime) -
            playDayTimelineMinutes(b.startTime, rule.startTime),
        ),
      };
    }),
  }));
}

/// Grilla de simulación (modo regla): canchas compartidas.
/// 1) Zonas primero (canchas en paralelo, categorías intercaladas).
/// 2) Intermedia solo después del último slot de zonas.
/// 3) Final solo después del último de intermedia (o zonas).
export function buildSimulationRuleGrid(
  input: BuildSimulationRuleGridInput,
): CourtDayRule[] {
  const slotMinutesByDate = new Map<string, number>();
  const packMinutesByDate = new Map<string, number>();
  const slots: CourtDaySlot[] = [];
  for (const day of input.playDays) {
    if (!day.date) continue;
    const sizes = slotSizesForSimulationDate(
      day.date,
      input.categoryLoads,
      input.zonesSlotMinutes,
    );
    const visualMinutes = slotStepMinutes(sizes, input.zonesSlotMinutes);
    const packMinutes = gcdOf([...sizes, MATCH_SLOT_UNIT_MIN]);
    slotMinutesByDate.set(day.date, visualMinutes);
    packMinutesByDate.set(day.date, packMinutes);
    // Empaqueta en el MCD (60 y 90 → 30) y después cada partido es una caja.
    slots.push(
      ...buildEmptyCourtDaySlots(
        { ...day, hasSlotSelection: false },
        input.courtCount,
        packMinutes,
      ),
    );
  }

  const loads = input.categoryLoads.map((load) => ({
    ...load,
    source: (input.currentCategoryId == null ||
    load.categoryId === input.currentCategoryId
      ? "self"
      : "other") as "self" | "other",
  }));

  packInterleavedProjectedMatches(
    slots,
    loads.map((l) => ({
      playDates: l.zonesPlayDates,
      matchCount: l.zoneMatches,
      matchDurations: Array.from(
        { length: l.zoneMatches },
        () => l.zonesSlotMinutes ?? input.zonesSlotMinutes,
      ),
      source: l.source,
      categoryId: l.categoryId,
    })),
    "zones",
    null,
  );

  const afterZones = latestProjectedCutoff(slots, ["zones"]);
  packPhaseInstances(slots, loads, "knockout", afterZones);

  const afterKnockout = latestProjectedCutoff(slots, ["zones", "knockout"]);
  packPhaseInstances(slots, loads, "final", afterKnockout);

  const rules = collapseRulesToMatches(
    groupSlotsIntoRules(
      input.playDays,
      slots,
      input.courtCount,
      slotMinutesByDate,
    ),
    packMinutesByDate,
  );
  for (const rule of rules) {
    rule.matchDurations = matchDurationsForSimulationDate(
      rule.playDate,
      input.categoryLoads,
      input.zonesSlotMinutes,
    );
  }
  return rules;
}

type SourcedCategoryLoad = SimulationCategoryLoad & {
  source: "self" | "other";
};

function packPhaseInstances(
  slots: CourtDaySlot[],
  loads: SourcedCategoryLoad[],
  phase: "knockout" | "final",
  afterCutoff: { playDate: string; slotIndex: number } | null,
) {
  const roundsKey = phase === "knockout" ? "knockoutRounds" : "finalRounds";
  const hasRounds = loads.some((load) => (load[roundsKey]?.length ?? 0) > 0);
  if (!hasRounds) {
    packInterleavedProjectedMatches(
      slots,
      loads.map((load) => ({
        playDates:
          phase === "knockout" ? load.knockoutPlayDates : load.finalPlayDates,
        matchCount:
          phase === "knockout" ? load.intermediateMatches : load.finalMatches,
        matchDurations: Array.from(
          {
            length:
              phase === "knockout"
                ? load.intermediateMatches
                : load.finalMatches,
          },
          () =>
            (phase === "knockout"
              ? load.knockoutSlotMinutes
              : load.finalSlotMinutes) ?? 60,
        ),
        source: load.source,
        categoryId: load.categoryId,
      })),
      phase,
      afterCutoff,
    );
    return;
  }

  let cutoff = afterCutoff;
  for (const key of BRACKET_ROUND_VALUES) {
    const phaseLoads = loads
      .map((load) => {
        const rounds = (load[roundsKey] ?? []).filter(
          (round) => round.key === key,
        );
        const matchCount = rounds.reduce(
          (sum, round) => sum + round.matchCount,
          0,
        );
        if (matchCount <= 0) return null;
        return {
          playDates: [...new Set(rounds.flatMap((round) => round.playDates))],
          matchCount,
          matchDurations: rounds.flatMap((round) =>
            Array.from({ length: round.matchCount }, () => round.slotMinutes),
          ),
          source: load.source,
          categoryId: load.categoryId,
        };
      })
      .filter((load): load is NonNullable<typeof load> => Boolean(load));
    if (phaseLoads.length === 0) continue;
    packInterleavedProjectedMatches(slots, phaseLoads, phase, cutoff);
    cutoff = latestProjectedCutoff(slots, ["zones", "knockout", "final"]);
  }
}

function applyReservations(
  slots: CourtDaySlot[],
  reservations: SlotReservationRef[],
  currentPairId?: string | null,
  preferenceMode = false,
  courtCount = 1,
): void {
  const pairsByTime = new Map<string, Set<string>>();
  for (const res of reservations) {
    const timeKey = `${res.playDate}:${res.slotIndex}`;
    const set = pairsByTime.get(timeKey) ?? new Set<string>();
    set.add(res.pairId);
    pairsByTime.set(timeKey, set);
  }

  const capacity = Math.max(1, courtCount);
  for (const slot of slots) {
    slot.courtCapacity = capacity;
    slot.preferenceCount =
      pairsByTime.get(`${slot.playDate}:${slot.slotIndex}`)?.size ?? 0;
  }

  const byKey = new Map(
    slots.map((s) => [`${s.playDate}:${s.courtIndex}:${s.slotIndex}`, s]),
  );

  for (const res of reservations) {
    if (preferenceMode && currentPairId && res.pairId !== currentPairId) {
      continue;
    }
    const key = `${res.playDate}:${res.courtIndex}:${res.slotIndex}`;
    const slot = byKey.get(key);
    if (!slot || slot.status === "blocked") continue;
    slot.pairId = res.pairId;
    slot.pairLabel = res.pairLabel;
    slot.status =
      currentPairId && res.pairId === currentPairId ? "mine" : "reserved";
  }
}

export function countMineSlots(rules: CourtDayRule[]): number {
  return rules.reduce(
    (sum, day) =>
      sum +
      day.courts.reduce(
        (cSum, court) =>
          cSum + court.slots.filter((s) => s.status === "mine").length,
        0,
      ),
    0,
  );
}

/// En inscripción la preferencia es solo horaria (indistinta de cancha).
export function mergeRegistrationDaySlots(day: CourtDayRule): CourtDaySlot[] {
  const bySlotIndex = new Map<number, CourtDaySlot[]>();
  for (const court of day.courts) {
    for (const slot of court.slots) {
      const list = bySlotIndex.get(slot.slotIndex) ?? [];
      list.push(slot);
      bySlotIndex.set(slot.slotIndex, list);
    }
  }

  return [...bySlotIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, slots]) => {
      const canonical = slots[0];
      const blocked = slots.find((s) => s.status === "blocked");
      const mine = slots.find((s) => s.status === "mine");
      const reserved = slots.find((s) => s.status === "reserved");

      let status: SlotCellStatus = "free";
      if (blocked) status = "blocked";
      else if (mine) status = "mine";
      else if (reserved) status = "reserved";

      return {
        ...canonical,
        courtIndex: 0,
        status,
        blockReason: blocked?.blockReason ?? canonical.blockReason,
        pairId: mine?.pairId ?? reserved?.pairId ?? canonical.pairId,
        pairLabel: mine?.pairLabel ?? reserved?.pairLabel ?? canonical.pairLabel,
        preferenceCount: Math.max(
          ...slots.map((slot) => slot.preferenceCount ?? 0),
          0,
        ),
        courtCapacity: canonical.courtCapacity,
      };
    });
}

/// Horarios que la pareja puede marcar como preferencia (excluye bloqueados).
export function listSelectablePreferenceSlots(
  rules: CourtDayRule[],
): CourtDaySlot[] {
  return rules
    .flatMap((day) => mergeRegistrationDaySlots(day))
    .filter((slot) => slot.status !== "blocked");
}

/// Horarios seleccionables de un día concreto.
export function listSelectablePreferenceSlotsForDay(
  day: CourtDayRule,
): CourtDaySlot[] {
  return mergeRegistrationDaySlots(day).filter(
    (slot) => slot.status !== "blocked",
  );
}

export function playDayCapacityMinutes(
  playDay: PlayDayValues,
  courtCount: number,
  slotMinutes?: number,
): number {
  const courts = Math.max(1, courtCount);
  if (playDay.hasSlotSelection && slotMinutes && slotMinutes > 0) {
    return playDayRulerSelectedMinutes(playDay, slotMinutes) * courts;
  }
  return playDayWindowMinutes(playDay.startTime, playDay.endTime) * courts;
}

const PHASE_PACK_ORDER: SimulationPhaseKey[] = ["zones", "knockout", "final"];

function flattenRuleSlots(rules: CourtDayRule[]): CourtDaySlot[] {
  return rules.flatMap((day) => day.courts.flatMap((court) => court.slots));
}

export interface IntegralSimulationCategory {
  categoryId: string;
  result: CategoryScheduleSimulation;
  zonesPlayDates: string[];
  knockoutPlayDates: string[];
  finalPlayDates: string[];
}

export interface IntegralPhaseSummary {
  key: SimulationPhaseKey;
  label: string;
  matchCount: number;
  /// Partidos que entraron en la grilla (todas las categorías).
  packedCount: number;
  dayCount: number;
  minutesNeeded: number;
  minutesAvailable: number;
  surplusMinutes: number;
  fits: boolean;
  missingPlayDates: boolean;
}

export interface IntegralCategorySummary {
  categoryId: string;
  matchCount: number;
  packedCount: number;
  packedByPhase: Record<SimulationPhaseKey, number>;
}

export interface IntegralSimulationSummary {
  phases: IntegralPhaseSummary[];
  categories: IntegralCategorySummary[];
  matchCount: number;
  packedCount: number;
  minutesNeeded: number;
  minutesAvailable: number;
  surplusMinutes: number;
  totalCells: number;
  usedCells: number;
  freeCells: number;
  fits: boolean;
}

function emptyPhaseCounter(): Record<SimulationPhaseKey, number> {
  return { zones: 0, knockout: 0, final: 0 };
}

/**
 * Totales de la simulación integral: suma las categorías y usa la grilla
 * compartida (un solo conjunto de días) como fuente de verdad de lo que entra.
 * Los slots libres de un día se atribuyen a la última fase que tiene ese día.
 */
function ruleSlotMinutes(
  rules: CourtDayRule[],
  playDate: string,
  fallback: number,
): number {
  const rule = rules.find((day) => day.playDate === playDate);
  return Math.max(1, rule?.slotMinutes ?? fallback);
}

export function summarizeIntegralSimulation(
  rules: CourtDayRule[],
  categories: IntegralSimulationCategory[],
  slotMinutes: number,
): IntegralSimulationSummary {
  const slots = flattenRuleSlots(rules);
  const fallbackMin = Math.max(1, slotMinutes);

  const datesByPhase: Record<SimulationPhaseKey, Set<string>> = {
    zones: new Set(),
    knockout: new Set(),
    final: new Set(),
  };
  for (const category of categories) {
    for (const date of category.zonesPlayDates) {
      if (date) datesByPhase.zones.add(date);
    }
    for (const date of category.knockoutPlayDates) {
      if (date) datesByPhase.knockout.add(date);
    }
    for (const date of category.finalPlayDates) {
      if (date) datesByPhase.final.add(date);
    }
  }

  const freeByDate = new Map<string, number>();
  const freeMinByDate = new Map<string, number>();
  let usedCells = 0;
  for (const slot of slots) {
    if (slot.status === "free") {
      freeByDate.set(slot.playDate, (freeByDate.get(slot.playDate) ?? 0) + 1);
      freeMinByDate.set(
        slot.playDate,
        (freeMinByDate.get(slot.playDate) ?? 0) + slotDurationMinutes(slot),
      );
    } else if (slot.status === "projected") {
      usedCells += 1;
    }
  }

  const freeMinByPhase = emptyPhaseCounter();
  for (const [date, minutes] of freeMinByDate) {
    let owner: SimulationPhaseKey | null = null;
    for (const key of PHASE_PACK_ORDER) {
      if (datesByPhase[key].has(date)) owner = key;
    }
    if (owner) freeMinByPhase[owner] += minutes;
  }

  const packedByPhase = emptyPhaseCounter();
  const packedByCategory = new Map<string, Record<SimulationPhaseKey, number>>();
  for (const slot of slots) {
    if (!isProjectedMatchLead(slot) || !slot.projectedPhase) continue;
    packedByPhase[slot.projectedPhase] += 1;
    if (!slot.projectedCategoryId) continue;
    const row =
      packedByCategory.get(slot.projectedCategoryId) ?? emptyPhaseCounter();
    row[slot.projectedPhase] += 1;
    packedByCategory.set(slot.projectedCategoryId, row);
  }

  let totalUnmetMin = 0;
  const phases: IntegralPhaseSummary[] = PHASE_PACK_ORDER.map((key) => {
    let matchCount = 0;
    let minutesNeeded = 0;
    for (const category of categories) {
      const phase = category.result.phases.find((p) => p.key === key);
      if (!phase) continue;
      matchCount += phase.matchCount;
      minutesNeeded += phase.minutesNeeded;
    }

    const packedCount = packedByPhase[key];
    const dayCount = rules.filter((day) => datesByPhase[key].has(day.playDate))
      .length;
    const missingPlayDates = matchCount > 0 && dayCount === 0;
    const minutesPerMatch =
      matchCount > 0 ? minutesNeeded / matchCount : fallbackMin;
    const unmetMin = Math.max(0, matchCount - packedCount) * minutesPerMatch;
    totalUnmetMin += unmetMin;
    const surplusMinutes = freeMinByPhase[key] - unmetMin;

    return {
      key,
      label: TOURNAMENT_PHASE_META[key].label,
      matchCount,
      packedCount,
      dayCount,
      minutesNeeded,
      minutesAvailable: Math.max(0, minutesNeeded + surplusMinutes),
      surplusMinutes,
      fits:
        !missingPlayDates &&
        (matchCount === 0 || packedCount >= matchCount) &&
        surplusMinutes >= 0,
      missingPlayDates,
    };
  });

  const assignedDates = new Set(
    PHASE_PACK_ORDER.flatMap((key) => [...datesByPhase[key]]),
  );
  let freeCells = 0;
  let freeMinutes = 0;
  for (const [date, count] of freeByDate) {
    if (!assignedDates.has(date)) continue;
    freeCells += count;
    freeMinutes += freeMinByDate.get(date) ?? 0;
  }

  const minutesNeeded = phases.reduce((sum, p) => sum + p.minutesNeeded, 0);
  const surplusMinutes = freeMinutes - totalUnmetMin;
  const activePhases = phases.filter((p) => p.matchCount > 0);

  return {
    phases,
    categories: categories.map((category) => {
      const row = packedByCategory.get(category.categoryId) ?? emptyPhaseCounter();
      return {
        categoryId: category.categoryId,
        matchCount: category.result.totalMatches,
        packedCount: row.zones + row.knockout + row.final,
        packedByPhase: row,
      };
    }),
    matchCount: phases.reduce((sum, p) => sum + p.matchCount, 0),
    packedCount: phases.reduce((sum, p) => sum + p.packedCount, 0),
    minutesNeeded,
    minutesAvailable: Math.max(0, minutesNeeded + surplusMinutes),
    surplusMinutes,
    totalCells: slots.length,
    usedCells,
    freeCells,
    fits:
      activePhases.length === 0 ? true : activePhases.every((p) => p.fits),
  };
}

/**
 * Actualiza Disponible / Balance / fits de la simulación a partir de la grilla
 * empaquetada (la regla es la fuente de verdad).
 * Los slots libres de un día se atribuyen a la última fase que tiene ese día.
 */
export function applyPackedSlotsToSimulation(
  result: CategoryScheduleSimulation,
  rules: CourtDayRule[],
  phasePlayDates: Record<SimulationPhaseKey, string[]>,
  slotMinutes: number,
): CategoryScheduleSimulation {
  const slots = flattenRuleSlots(rules);
  const cellMin = Math.max(1, slotMinutes);

  const freeByDate = new Map<string, number>();
  for (const slot of slots) {
    if (slot.status !== "free") continue;
    freeByDate.set(slot.playDate, (freeByDate.get(slot.playDate) ?? 0) + 1);
  }

  const freeCellsByPhase = emptyPhaseCounter();
  for (const [date, count] of freeByDate) {
    let owner: SimulationPhaseKey | null = null;
    for (const key of PHASE_PACK_ORDER) {
      if (phasePlayDates[key]?.includes(date)) owner = key;
    }
    if (owner) freeCellsByPhase[owner] += count;
  }

  const phases = result.phases.map((phase) => {
    const selfPacked = slots.filter(
      (s) =>
        isProjectedMatchLead(s) &&
        s.projectedPhase === phase.key &&
        s.projectedSource === "self",
    ).length;

    const freeMin = freeCellsByPhase[phase.key] * cellMin;
    const unmetMatches = Math.max(0, phase.matchCount - selfPacked);
    const minutesPerMatch =
      phase.matchCount > 0
        ? phase.minutesNeeded / phase.matchCount
        : cellMin;
    const unmetMin = unmetMatches * minutesPerMatch;
    const surplusMinutes = freeMin - unmetMin;
    const minutesAvailable = phase.minutesNeeded + surplusMinutes;
    const fits =
      !phase.missingPlayDates &&
      (phase.matchCount === 0 || selfPacked >= phase.matchCount) &&
      surplusMinutes >= 0;

    return {
      ...phase,
      minutesAvailable: Math.max(0, minutesAvailable),
      surplusMinutes,
      fits,
    };
  });

  const assignedDates = new Set(
    PHASE_PACK_ORDER.flatMap((key) => phasePlayDates[key] ?? []).filter(
      Boolean,
    ),
  );
  let totalFreeCells = 0;
  for (const [date, count] of freeByDate) {
    if (assignedDates.has(date)) totalFreeCells += count;
  }

  let totalUnmetMin = 0;
  for (const phase of result.phases) {
    const selfPacked = slots.filter(
      (s) =>
        isProjectedMatchLead(s) &&
        s.projectedPhase === phase.key &&
        s.projectedSource === "self",
    ).length;
    const unmetMatches = Math.max(0, phase.matchCount - selfPacked);
    const minutesPerMatch =
      phase.matchCount > 0
        ? phase.minutesNeeded / phase.matchCount
        : cellMin;
    totalUnmetMin += unmetMatches * minutesPerMatch;
  }

  const totalFreeMin = totalFreeCells * cellMin;
  const surplusMinutes = totalFreeMin - totalUnmetMin;
  const minutesAvailable = result.minutesNeeded + surplusMinutes;
  const activePhases = phases.filter((p) => p.matchCount > 0);
  const fits =
    activePhases.length === 0 ? true : activePhases.every((p) => p.fits);

  return {
    ...result,
    phases,
    minutesAvailable: Math.max(0, minutesAvailable),
    surplusMinutes,
    fits,
  };
}
