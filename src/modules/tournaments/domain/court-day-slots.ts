import {
  minutesToTime,
  timeToMinutes,
  closingMinutes,
} from "@/modules/bookings/domain/rules";
import { TOURNAMENT_PHASE_META } from "./config-schema";
import type { PlayDayValues } from "./config-schema";
import { playDayWindowMinutes } from "./play-day";
import {
  buildPlayDayRulerSlots,
  playDayRulerSelectedMinutes,
} from "./play-day-slots";
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
  source: "self" | "other";
  categoryId?: string;
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
      left: l.matchCount,
    }));
  if (remaining.length === 0) return;

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
    slot.projectedCategoryId = chosen.categoryId;
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
}

export function slotMinutesForSimulationDate(
  playDate: string,
  loads: Pick<
    SimulationCategoryLoad,
    | "zonesPlayDates"
    | "knockoutPlayDates"
    | "finalPlayDates"
    | "zonesSlotMinutes"
    | "knockoutSlotMinutes"
    | "finalSlotMinutes"
  >[],
  fallback: number,
): number {
  let max = 0;
  for (const load of loads) {
    if (load.zonesPlayDates.includes(playDate)) {
      max = Math.max(max, load.zonesSlotMinutes ?? fallback);
    }
    if (load.knockoutPlayDates.includes(playDate)) {
      max = Math.max(max, load.knockoutSlotMinutes ?? fallback);
    }
    if (load.finalPlayDates.includes(playDate)) {
      max = Math.max(max, load.finalSlotMinutes ?? fallback);
    }
  }
  return max > 0 ? max : Math.max(1, fallback);
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
  const slots: CourtDaySlot[] = [];
  const zonesDates = new Set(
    (input.zonesPlayDates ?? input.playDays.map((day) => day.date)).filter(
      Boolean,
    ),
  );

  for (const day of input.playDays) {
    if (!day.date || !zonesDates.has(day.date)) continue;
    const daySlotMinutes = Math.max(
      1,
      input.slotMinutesByDate?.[day.date] ?? fallback,
    );
    slotMinutesByDate.set(day.date, daySlotMinutes);
    slots.push(
      ...buildEmptyCourtDaySlots(
        { ...day, hasSlotSelection: false },
        input.courtCount,
        daySlotMinutes,
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
    const byIndex =
      match.slotIndex != null
        ? byKey.get(
            `${match.playDate}:${match.courtIndex}:${match.slotIndex}`,
          )
        : undefined;
    const slot =
      byIndex ??
      (match.startTime
        ? byTime.get(
            `${match.playDate}:${match.courtIndex}:${match.startTime}`,
          )
        : undefined);
    if (!slot) continue;
    slot.status = "projected";
    slot.projectedPhase = match.projectedPhase ?? "zones";
    slot.projectedSource = "self";
    const occupant = {
      categoryId: match.categoryId,
      matchCode: match.matchCode ?? null,
      pair1Label: match.pair1Label ?? null,
      pair2Label: match.pair2Label ?? null,
    };
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

  const rules = groupSlotsIntoRules(
    input.playDays,
    slots,
    input.courtCount,
    slotMinutesByDate,
  );
  const labelByDate = new Map(
    input.playDays
      .filter((day) => day.date)
      .map((day, index) => [day.date, `Día ${index + 1}`] as const),
  );
  for (const rule of rules) {
    rule.dayLabel = labelByDate.get(rule.playDate) ?? rule.dayLabel;
  }
  return rules;
}

/// Grilla de simulación (modo regla): canchas compartidas.
/// 1) Zonas primero (canchas en paralelo, categorías intercaladas).
/// 2) Intermedia solo después del último slot de zonas.
/// 3) Final solo después del último de intermedia (o zonas).
export function buildSimulationRuleGrid(
  input: BuildSimulationRuleGridInput,
): CourtDayRule[] {
  const slotMinutesByDate = new Map<string, number>();
  const slots: CourtDaySlot[] = [];
  for (const day of input.playDays) {
    if (!day.date) continue;
    const daySlotMinutes = slotMinutesForSimulationDate(
      day.date,
      input.categoryLoads,
      input.zonesSlotMinutes,
    );
    slotMinutesByDate.set(day.date, daySlotMinutes);
    // La duración la marca la fase de ese día (zonas 60, final 75, etc.).
    // El rango start/end es lo compartido con Parámetros; no reusar índices
    // de una regla de otro tamaño.
    slots.push(
      ...buildEmptyCourtDaySlots(
        { ...day, hasSlotSelection: false },
        input.courtCount,
        daySlotMinutes,
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
      source: l.source,
      categoryId: l.categoryId,
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
      categoryId: l.categoryId,
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
      categoryId: l.categoryId,
    })),
    "final",
    afterKnockout,
  );

  return groupSlotsIntoRules(
    input.playDays,
    slots,
    input.courtCount,
    slotMinutesByDate,
  );
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
  let usedCells = 0;
  for (const slot of slots) {
    if (slot.status === "free") {
      freeByDate.set(slot.playDate, (freeByDate.get(slot.playDate) ?? 0) + 1);
    } else if (slot.status === "projected") {
      usedCells += 1;
    }
  }

  const freeMinByPhase = emptyPhaseCounter();
  for (const [date, count] of freeByDate) {
    let owner: SimulationPhaseKey | null = null;
    for (const key of PHASE_PACK_ORDER) {
      if (datesByPhase[key].has(date)) owner = key;
    }
    if (owner) {
      freeMinByPhase[owner] +=
        count * ruleSlotMinutes(rules, date, fallbackMin);
    }
  }

  const packedByPhase = emptyPhaseCounter();
  const packedByCategory = new Map<string, Record<SimulationPhaseKey, number>>();
  for (const slot of slots) {
    if (slot.status !== "projected" || !slot.projectedPhase) continue;
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
    freeMinutes += count * ruleSlotMinutes(rules, date, fallbackMin);
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
