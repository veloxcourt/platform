import {
  minutesToTime,
  timeToMinutes,
  closingMinutes,
} from "@/modules/bookings/domain/rules";
import type { PlayDayValues } from "./config-schema";
import { playDayWindowMinutes } from "./play-day";
import type { CategoryScheduleSimulation } from "./simulate-category-schedule";

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
  projectedPhase?: "zones" | "knockout" | "final";
  /// En simulación: si la celda la ocupó otra categoría (mismas canchas físicas).
  projectedSource?: "self" | "other";
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
  courts: {
    courtIndex: number;
    courtLabel: string;
    slots: CourtDaySlot[];
  }[];
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
  const start = timeToMinutes(playDay.startTime);
  const end = closingMinutes(playDay.startTime, playDay.endTime);
  const window = end - start;
  const slotsPerCourt = Math.floor(window / slotMinutes);
  if (slotsPerCourt <= 0) return [];

  const courts = Math.max(1, courtCount);
  const slots: CourtDaySlot[] = [];

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
        courts: Array.from({ length: courts }, (_, courtIndex) => ({
          courtIndex,
          courtLabel: `Cancha ${courtIndex + 1}`,
          slots: daySlots
            .filter((s) => s.courtIndex === courtIndex)
            .sort((a, b) => a.slotIndex - b.slotIndex),
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
  phases: Array<"zones" | "knockout" | "final">,
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

function packProjectedMatches(
  slots: CourtDaySlot[],
  playDates: string[],
  matchCount: number,
  phase: "zones" | "knockout" | "final",
  source: "self" | "other" = "self",
  afterCutoff: { playDate: string; slotIndex: number } | null = null,
): void {
  if (matchCount <= 0 || playDates.length === 0) return;

  const candidates = freeSlotsForDates(slots, playDates, afterCutoff);
  let left = matchCount;
  for (const slot of candidates) {
    if (left <= 0) break;
    slot.status = "projected";
    slot.projectedPhase = phase;
    slot.projectedSource = source;
    left -= 1;
  }
}

/// Coloca partidos intercalados (A, B, A, B…) llenando canchas en paralelo por horario.
function packInterleavedProjectedMatches(
  slots: CourtDaySlot[],
  loads: {
    playDates: string[];
    matchCount: number;
    source: "self" | "other";
  }[],
  phase: "zones" | "knockout" | "final",
  afterCutoff: { playDate: string; slotIndex: number } | null = null,
): void {
  const remaining = loads
    .filter((l) => l.matchCount > 0 && l.playDates.length > 0)
    .map((l) => ({
      ...l,
      dateSet: new Set(l.playDates.filter(Boolean)),
      left: l.matchCount,
    }));
  if (remaining.length === 0) return;

  if (remaining.length === 1) {
    packProjectedMatches(
      slots,
      remaining[0].playDates,
      remaining[0].matchCount,
      phase,
      remaining[0].source,
      afterCutoff,
    );
    return;
  }

  const allDates = [...new Set(remaining.flatMap((l) => [...l.dateSet]))];
  const ordered = freeSlotsForDates(slots, allDates, afterCutoff);

  let cursor = 0;
  for (const slot of ordered) {
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

    slot.status = "projected";
    slot.projectedPhase = phase;
    slot.projectedSource = chosen.source;
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

export interface SimulationCategoryLoad {
  categoryId: string;
  zonesPlayDates: string[];
  knockoutPlayDates: string[];
  finalPlayDates: string[];
  zoneMatches: number;
  intermediateMatches: number;
  finalMatches: number;
}

export interface BuildSimulationRuleGridInput {
  playDays: PlayDayValues[];
  courtCount: number;
  zonesSlotMinutes: number;
  /// Todas las categorías en simulación (misma pool de canchas).
  categoryLoads: SimulationCategoryLoad[];
  /// Categoría desde la que se mira la grilla (self vs other).
  currentCategoryId: string;
}

/// Grilla de simulación (modo regla): canchas compartidas.
/// 1) Zonas primero (canchas en paralelo, categorías intercaladas).
/// 2) Intermedia solo después del último slot de zonas.
/// 3) Final solo después del último de intermedia (o zonas).
export function buildSimulationRuleGrid(
  input: BuildSimulationRuleGridInput,
): CourtDayRule[] {
  const slots: CourtDaySlot[] = [];
  for (const day of input.playDays) {
    if (!day.date) continue;
    slots.push(
      ...buildEmptyCourtDaySlots(
        day,
        input.courtCount,
        input.zonesSlotMinutes,
      ),
    );
  }

  const loads = input.categoryLoads.map((load) => ({
    ...load,
    source: (load.categoryId === input.currentCategoryId
      ? "self"
      : "other") as "self" | "other",
  }));

  packInterleavedProjectedMatches(
    slots,
    loads.map((l) => ({
      playDates: l.zonesPlayDates,
      matchCount: l.zoneMatches,
      source: l.source,
    })),
    "zones",
    null,
  );

  const afterZones = latestProjectedCutoff(slots, ["zones"]);
  packInterleavedProjectedMatches(
    slots,
    loads.map((l) => ({
      playDates: l.knockoutPlayDates,
      matchCount: l.intermediateMatches,
      source: l.source,
    })),
    "knockout",
    afterZones,
  );

  const afterKnockout = latestProjectedCutoff(slots, ["zones", "knockout"]);
  packInterleavedProjectedMatches(
    slots,
    loads.map((l) => ({
      playDates: l.finalPlayDates,
      matchCount: l.finalMatches,
      source: l.source,
    })),
    "final",
    afterKnockout,
  );

  return groupSlotsIntoRules(input.playDays, slots, input.courtCount);
}

function applyReservations(
  slots: CourtDaySlot[],
  reservations: SlotReservationRef[],
  currentPairId?: string | null,
  preferenceMode = false,
): void {
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
): number {
  return (
    playDayWindowMinutes(playDay.startTime, playDay.endTime) *
    Math.max(1, courtCount)
  );
}

const PHASE_PACK_ORDER: Array<"zones" | "knockout" | "final"> = [
  "zones",
  "knockout",
  "final",
];

function flattenRuleSlots(rules: CourtDayRule[]): CourtDaySlot[] {
  return rules.flatMap((day) => day.courts.flatMap((court) => court.slots));
}

/**
 * Actualiza Disponible / Balance / fits de la simulación a partir de la grilla
 * empaquetada (la regla es la fuente de verdad).
 * Los slots libres de un día se atribuyen a la última fase que tiene ese día.
 */
export function applyPackedSlotsToSimulation(
  result: CategoryScheduleSimulation,
  rules: CourtDayRule[],
  phasePlayDates: Record<
    "zones" | "knockout" | "final",
    string[]
  >,
  slotMinutes: number,
): CategoryScheduleSimulation {
  const slots = flattenRuleSlots(rules);
  const cellMin = Math.max(1, slotMinutes);

  const freeByDate = new Map<string, number>();
  for (const slot of slots) {
    if (slot.status !== "free") continue;
    freeByDate.set(slot.playDate, (freeByDate.get(slot.playDate) ?? 0) + 1);
  }

  const freeCellsByPhase: Record<"zones" | "knockout" | "final", number> = {
    zones: 0,
    knockout: 0,
    final: 0,
  };
  for (const [date, count] of freeByDate) {
    let owner: "zones" | "knockout" | "final" | null = null;
    for (const key of PHASE_PACK_ORDER) {
      if (phasePlayDates[key]?.includes(date)) owner = key;
    }
    if (owner) freeCellsByPhase[owner] += count;
  }

  const phases = result.phases.map((phase) => {
    const selfPacked = slots.filter(
      (s) =>
        s.status === "projected" &&
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
        s.status === "projected" &&
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
