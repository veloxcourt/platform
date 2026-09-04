import { buildEmptyCourtDaySlots } from "./court-day-slots";
import type { PlayDayValues } from "./config-schema";
import { comparePlayDaySchedule, playDayTimelineMinutes } from "./play-day";
import { distributeZoneSizes } from "./simulate-category-schedule";
import {
  zoneLabelFromIndex,
  zonePairings,
  type ZoneMatchKind,
} from "./zone-bracket";
import type { ZonesDayPreference } from "./zones-day-preference";

export type FixtureSlotPref = {
  playDate: string;
  slotIndex: number;
  startTime: string;
  endTime: string;
};

export type FixturePairInput = {
  id: string;
  zonesDayPreference: ZonesDayPreference;
  preferences: FixtureSlotPref[];
};

export type ZoneRuleBreak = "rest" | "day_pref" | "cell_pref";

export const ZONE_RULE_BREAK_LABELS: Record<ZoneRuleBreak, string> = {
  rest: "Sin descanso",
  day_pref: "Pref. día",
  cell_pref: "Pref. horario",
};

export type ScheduledZoneMatch = {
  matchIndex: number;
  kind: ZoneMatchKind;
  playDate: string | null;
  startTime: string | null;
  endTime: string | null;
  courtIndex: number | null;
  pair1Id: string | null;
  pair2Id: string | null;
  /// Índice de celda en el día (para descanso / detección).
  slotIndex?: number | null;
  /// True si alguna pareja del partido juega sin la celda de descanso.
  noRestGap?: boolean;
  /// Reglas blandas que la oleada u otra regla dura dejó de lado (solo informar).
  ruleBreaks?: ZoneRuleBreak[];
};

export type ScheduledZone = {
  label: string;
  pairIds: string[];
  matches: ScheduledZoneMatch[];
};

export type ZonesFixtureResult = {
  zones: ScheduledZone[];
  warnings: string[];
  unassignedPairIds: string[];
  builtAt: string;
};

export type ReservedCourtSlot = {
  playDate: string;
  courtIndex: number;
  startTime: string;
  endTime?: string | null;
};

export type BuildZonesFixtureInput = {
  pairs: FixturePairInput[];
  pairsPerZone: number;
  playDays: PlayDayValues[];
  zonesPlayDates: string[];
  courtCount: number;
  slotMinutes: number;
  /// Canchas/horarios ya tomados por otras categorías (misma pileta física).
  reservedSlots?: ReservedCourtSlot[];
};

export function reservedSlotsFromOtherFixtures(
  categories: Array<{
    categoryId: string;
    zonesFixture: {
      zones: Array<{
        matches: Array<{
          playDate: string | null;
          startTime: string | null;
          endTime?: string | null;
          courtIndex: number | null;
        }>;
      }>;
    } | null;
  }>,
  exceptCategoryId: string,
): ReservedCourtSlot[] {
  const out: ReservedCourtSlot[] = [];
  for (const category of categories) {
    if (category.categoryId === exceptCategoryId) continue;
    for (const zone of category.zonesFixture?.zones ?? []) {
      for (const match of zone.matches) {
        if (!match.playDate || match.courtIndex == null || !match.startTime) {
          continue;
        }
        out.push({
          playDate: match.playDate,
          courtIndex: match.courtIndex,
          startTime: match.startTime,
          endTime: match.endTime,
        });
      }
    }
  }
  return out;
}

type ResourceSlot = {
  playDate: string;
  courtIndex: number;
  slotIndex: number;
  startTime: string;
  endTime: string;
};

/** Celdas de descanso preferidas entre dos partidos de la misma pareja. */
export const ZONE_PAIR_REST_SLOTS = 1;

function prefKey(playDate: string, slotIndex: number) {
  return `${playDate}:${slotIndex}`;
}

function resourceKey(playDate: string, courtIndex: number, startTime: string) {
  return `${playDate}:${courtIndex}:${startTime}`;
}

function pairBusyKey(playDate: string, slotIndex: number) {
  return `${playDate}:${slotIndex}`;
}

function pairTimeKey(playDate: string, startTime: string) {
  return `time:${playDate}:${startTime}`;
}

type SlotBound = {
  playDate: string;
  slotIndex: number;
};

function compareSlotBounds(a: SlotBound, b: SlotBound): number {
  if (a.playDate !== b.playDate) return a.playDate.localeCompare(b.playDate);
  return a.slotIndex - b.slotIndex;
}

function isSlotAfterBound(slot: SlotBound, bound: SlotBound): boolean {
  return compareSlotBounds(slot, bound) > 0;
}

/// Última apertura ya programada de la zona. Null si falta alguna.
export function latestScheduledOpeningBound(
  matches: Array<{
    kind: ZoneMatchKind;
    playDate?: string | null;
    slotIndex?: number | null;
  }>,
): SlotBound | null {
  const openings = matches.filter((match) => match.kind === "opening");
  if (openings.length === 0) return null;

  const scheduled: SlotBound[] = [];
  for (const match of openings) {
    if (!match.playDate || match.slotIndex == null) return null;
    scheduled.push({ playDate: match.playDate, slotIndex: match.slotIndex });
  }
  if (scheduled.length < openings.length) return null;

  return scheduled.reduce((latest, stamp) =>
    compareSlotBounds(stamp, latest) > 0 ? stamp : latest,
  );
}

/**
 * Conflicto de ocupación de pareja.
 * - Siempre: mismo slotIndex o misma hora (aunque sea otra cancha).
 * - Si requireRest: también slots adyacentes (sin celda de descanso).
 */
function pairSlotConflicts(
  busy: Set<string> | undefined,
  playDate: string,
  slotIndex: number,
  startTime: string,
  requireRest: boolean,
): boolean {
  if (!busy || busy.size === 0) return false;
  if (busy.has(pairBusyKey(playDate, slotIndex))) return true;
  if (startTime && busy.has(pairTimeKey(playDate, startTime))) return true;
  if (!requireRest) return false;
  for (let d = 1; d <= ZONE_PAIR_REST_SLOTS; d++) {
    if (busy.has(pairBusyKey(playDate, slotIndex - d))) return true;
    if (busy.has(pairBusyKey(playDate, slotIndex + d))) return true;
  }
  return false;
}

function pairRespectsRestGap(
  busy: Set<string> | undefined,
  playDate: string,
  slotIndex: number,
  startTime: string,
): boolean {
  return !pairSlotConflicts(busy, playDate, slotIndex, startTime, true);
}

function dayOpenFor(
  playDate: string,
  dayOpenByDate?: Map<string, string> | Record<string, string>,
): string | undefined {
  if (!dayOpenByDate) return undefined;
  return dayOpenByDate instanceof Map
    ? dayOpenByDate.get(playDate)
    : dayOpenByDate[playDate];
}

/**
 * Detecta partidos donde una pareja queda sin la celda de descanso.
 * Útil en UI tras ediciones manuales (compara horarios con slotMinutes).
 */
export function keysWithNoRestGap(
  matches: Array<{
    key: string;
    playDate: string | null | undefined;
    startTime: string | null | undefined;
    pairIds: Array<string | null | undefined>;
  }>,
  dayOpenByDate: Map<string, string> | Record<string, string> | undefined,
  slotMinutes: number,
): Set<string> {
  const step = Math.max(1, slotMinutes);
  const maxGapMin = ZONE_PAIR_REST_SLOTS * step;
  const byPair = new Map<
    string,
    Array<{ key: string; playDate: string; minutes: number }>
  >();

  for (const match of matches) {
    const playDate = match.playDate?.trim() || "";
    const startTime = match.startTime?.trim() || "";
    if (!playDate || !startTime) continue;
    const minutes = playDayTimelineMinutes(
      startTime,
      dayOpenFor(playDate, dayOpenByDate),
    );
    for (const pairId of match.pairIds) {
      if (!pairId) continue;
      const list = byPair.get(pairId) ?? [];
      list.push({ key: match.key, playDate, minutes });
      byPair.set(pairId, list);
    }
  }

  const flagged = new Set<string>();
  for (const list of byPair.values()) {
    const byDate = new Map<string, typeof list>();
    for (const entry of list) {
      const day = byDate.get(entry.playDate) ?? [];
      day.push(entry);
      byDate.set(entry.playDate, day);
    }
    for (const dayList of byDate.values()) {
      dayList.sort((a, b) => a.minutes - b.minutes);
      for (let i = 1; i < dayList.length; i++) {
        const prev = dayList[i - 1]!;
        const cur = dayList[i]!;
        const gap = cur.minutes - prev.minutes;
        if (gap <= maxGapMin) {
          flagged.add(prev.key);
          flagged.add(cur.key);
        }
      }
    }
  }
  return flagged;
}

function overlapCount(
  a: Set<string>,
  b: Iterable<string>,
): number {
  let n = 0;
  for (const key of b) {
    if (a.has(key)) n += 1;
  }
  return n;
}

function preferenceKeys(pair: FixturePairInput): Set<string> {
  return new Set(
    pair.preferences.map((p) => prefKey(p.playDate, p.slotIndex)),
  );
}

/// Asigna parejas a zonas priorizando solapamiento de preferencias horarias.
export function assignPairsToZones(
  pairs: FixturePairInput[],
  pairsPerZone: number,
): { zones: Array<{ label: string; pairIds: string[] }>; unassigned: string[] } {
  const sizes = distributeZoneSizes(pairs.length, pairsPerZone || 3);
  if (sizes.length === 0) {
    return { zones: [], unassigned: pairs.map((p) => p.id) };
  }

  const remaining = [...pairs].sort((a, b) => {
    const diff = a.preferences.length - b.preferences.length;
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const zones: Array<{ label: string; pairIds: string[] }> = [];

  for (let zi = 0; zi < sizes.length; zi++) {
    const size = sizes[zi]!;
    if (remaining.length === 0) break;

    const seed = remaining.shift()!;
    const members: FixturePairInput[] = [seed];
    let zoneKeys = preferenceKeys(seed);

    while (members.length < size && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]!;
        const keys = preferenceKeys(candidate);
        const score =
          zoneKeys.size === 0 || keys.size === 0
            ? 0
            : overlapCount(zoneKeys, keys);
        if (
          score > bestScore ||
          (score === bestScore &&
            candidate.preferences.length <
              (remaining[bestIdx]?.preferences.length ?? Infinity))
        ) {
          bestScore = score;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0]!;
      members.push(next);
      if (zoneKeys.size === 0) {
        zoneKeys = preferenceKeys(next);
      } else if (next.preferences.length > 0) {
        const nextKeys = preferenceKeys(next);
        const intersection = new Set(
          [...zoneKeys].filter((k) => nextKeys.has(k)),
        );
        zoneKeys = intersection.size > 0 ? intersection : new Set([...zoneKeys, ...nextKeys]);
      }
    }

    zones.push({
      label: zoneLabelFromIndex(zi),
      pairIds: members.map((m) => m.id),
    });
  }

  return {
    zones,
    unassigned: remaining.map((p) => p.id),
  };
}

function buildResourceSlots(input: BuildZonesFixtureInput): ResourceSlot[] {
  const zonesDates = new Set(input.zonesPlayDates.filter(Boolean));
  const playDays = input.playDays.filter(
    (d) => d.date && zonesDates.has(d.date),
  );
  const courts = Math.max(1, input.courtCount);
  const slotMinutes = Math.max(1, input.slotMinutes);
  const out: ResourceSlot[] = [];

  for (const day of playDays) {
    const slots = buildEmptyCourtDaySlots(day, courts, slotMinutes);
    for (const slot of slots) {
      out.push({
        playDate: slot.playDate,
        courtIndex: slot.courtIndex,
        slotIndex: slot.slotIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
    }
  }

  return out.sort((a, b) => {
    if (a.playDate !== b.playDate) return a.playDate.localeCompare(b.playDate);
    // slotIndex respeta la línea de tiempo del día (incl. madrugada overnight).
    if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
    return a.courtIndex - b.courtIndex;
  });
}

function dayPrefAllows(
  preference: ZonesDayPreference,
  existingDates: Set<string>,
  candidateDate: string,
): boolean {
  if (existingDates.size === 0) return true;
  if (preference === "SAME_DAY") {
    return existingDates.has(candidateDate);
  }
  if (preference === "DIFFERENT_DAYS") {
    return !existingDates.has(candidateDate);
  }
  return true;
}

function intervalOverlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
  dayOpen?: string,
): boolean {
  const a0 = playDayTimelineMinutes(aStart, dayOpen);
  let a1 = playDayTimelineMinutes(aEnd, dayOpen);
  const b0 = playDayTimelineMinutes(bStart, dayOpen);
  let b1 = playDayTimelineMinutes(bEnd, dayOpen);
  if (a1 <= a0) a1 += 24 * 60;
  if (b1 <= b0) b1 += 24 * 60;
  return a0 < b1 && b0 < a1;
}

function seedOccupiedFromReserved(
  occupied: Set<string>,
  resources: ResourceSlot[],
  reserved: ReservedCourtSlot[],
  playDays: PlayDayValues[],
) {
  const dayOpen = new Map(
    playDays.filter((day) => day.date).map((day) => [day.date, day.startTime]),
  );
  for (const taken of reserved) {
    occupied.add(resourceKey(taken.playDate, taken.courtIndex, taken.startTime));
    const open = dayOpen.get(taken.playDate);
    const takenEnd = taken.endTime || taken.startTime;
    for (const resource of resources) {
      if (
        resource.playDate !== taken.playDate ||
        resource.courtIndex !== taken.courtIndex
      ) {
        continue;
      }
      if (
        intervalOverlaps(
          resource.startTime,
          resource.endTime,
          taken.startTime,
          takenEnd,
          open,
        )
      ) {
        occupied.add(
          resourceKey(resource.playDate, resource.courtIndex, resource.startTime),
        );
      }
    }
  }
}

function courtsBusyAtTime(
  occupied: Set<string>,
  playDate: string,
  startTime: string,
  courtCount: number,
): number {
  let n = 0;
  for (let c = 0; c < courtCount; c++) {
    if (occupied.has(resourceKey(playDate, c, startTime))) n += 1;
  }
  return n;
}

function uniqueRuleBreaks(breaks: ZoneRuleBreak[]): ZoneRuleBreak[] {
  return [...new Set(breaks)];
}

function collectRuleBreaks(
  slot: ResourceSlot,
  pair1: FixturePairInput | undefined,
  pair2: FixturePairInput | undefined,
  pairBusy: Map<string, Set<string>>,
  pairDates: Map<string, Set<string>>,
  ignoreCellPrefs: boolean,
): ZoneRuleBreak[] {
  const breaks: ZoneRuleBreak[] = [];
  for (const pair of [pair1, pair2]) {
    if (!pair) continue;
    if (
      !pairRespectsRestGap(
        pairBusy.get(pair.id),
        slot.playDate,
        slot.slotIndex,
        slot.startTime,
      )
    ) {
      breaks.push("rest");
    }
    const dates = pairDates.get(pair.id) ?? new Set<string>();
    if (!dayPrefAllows(pair.zonesDayPreference, dates, slot.playDate)) {
      breaks.push("day_pref");
    }
    if (
      !ignoreCellPrefs &&
      pair.preferences.length > 0 &&
      !preferenceKeys(pair).has(prefKey(slot.playDate, slot.slotIndex))
    ) {
      breaks.push("cell_pref");
    }
  }
  return uniqueRuleBreaks(breaks);
}

/**
 * Scoring dentro de una oleada (misma fecha + slotIndex).
 * La oleada ya está fijada: acá solo se elige cancha y se prefiere
 * no romper descanso / preferencias.
 */
function scoreSlot(
  slot: ResourceSlot,
  pair1: FixturePairInput | undefined,
  pair2: FixturePairInput | undefined,
  pairBusy: Map<string, Set<string>>,
  pairDates: Map<string, Set<string>>,
  occupied: Set<string>,
  courtCount: number,
  requireRest: boolean,
): number {
  let score = 0;

  // 1) Descanso: en fallback semi-duro seguimos prefiriendo huecos con gap.
  if (!requireRest) {
    const ok1 =
      !pair1 ||
      pairRespectsRestGap(
        pairBusy.get(pair1.id),
        slot.playDate,
        slot.slotIndex,
        slot.startTime,
      );
    const ok2 =
      !pair2 ||
      pairRespectsRestGap(
        pairBusy.get(pair2.id),
        slot.playDate,
        slot.slotIndex,
        slot.startTime,
      );
    if (ok1 && ok2) score += 100_000;
  }

  // 2) Preferencias (peso bajo frente al descanso).
  const key = prefKey(slot.playDate, slot.slotIndex);
  const in1 = pair1 && preferenceKeys(pair1).has(key);
  const in2 = pair2 && preferenceKeys(pair2).has(key);
  if (in1 && in2) score += 100;
  else if (in1 || in2) score += 40;

  // 3) Si ya jugaron un día y pueden repartir, preferir otro día
  //    (evita 17:00 y 19:00 el mismo día cuando hay Day 2 libre).
  for (const pair of [pair1, pair2]) {
    if (!pair) continue;
    const dates = pairDates.get(pair.id);
    if (!dates || dates.size === 0) continue;
    if (dates.has(slot.playDate)) {
      // Mismo día: preferir más separación que el mínimo de descanso.
      const busy = pairBusy.get(pair.id);
      if (busy) {
        let bestGap = Infinity;
        for (let i = 0; i < 64; i++) {
          if (!busy.has(pairBusyKey(slot.playDate, i))) continue;
          bestGap = Math.min(bestGap, Math.abs(slot.slotIndex - i));
        }
        if (Number.isFinite(bestGap) && bestGap > ZONE_PAIR_REST_SLOTS) {
          score += Math.min(bestGap, 6) * 800;
        }
      }
      continue;
    }
    if (
      pair.zonesDayPreference === "ANY" ||
      pair.zonesDayPreference === "DIFFERENT_DAYS"
    ) {
      score += 5_000;
    }
  }

  const busy = courtsBusyAtTime(
    occupied,
    slot.playDate,
    slot.startTime,
    courtCount,
  );
  if (busy > 0 && busy < courtCount) {
    score += 1_000;
  }

  score -= slot.courtIndex;
  return score;
}

type SlotPick = {
  slot: ResourceSlot;
  ruleBreaks: ZoneRuleBreak[];
};

function pairHardConflict(
  pair: FixturePairInput | undefined,
  pairBusy: Map<string, Set<string>>,
  slot: ResourceSlot,
): boolean {
  if (!pair) return false;
  return pairSlotConflicts(
    pairBusy.get(pair.id),
    slot.playDate,
    slot.slotIndex,
    slot.startTime,
    false,
  );
}

function leftoverOleadaHoleCount(
  resources: ResourceSlot[],
  occupied: Set<string>,
  courtCount: number,
): number {
  const laterBusy = new Set<string>();
  for (const slot of resources) {
    if (
      occupied.has(resourceKey(slot.playDate, slot.courtIndex, slot.startTime))
    ) {
      laterBusy.add(`${slot.playDate}:${slot.slotIndex}`);
    }
  }

  const waves = new Map<string, { free: number; busy: number; hasLater: boolean }>();
  for (const slot of resources) {
    const key = `${slot.playDate}:${slot.slotIndex}`;
    const wave = waves.get(key) ?? { free: 0, busy: 0, hasLater: false };
    if (
      occupied.has(resourceKey(slot.playDate, slot.courtIndex, slot.startTime))
    ) {
      wave.busy += 1;
    } else {
      wave.free += 1;
    }
    waves.set(key, wave);
  }

  let holes = 0;
  for (const [key, wave] of waves) {
    if (wave.busy === 0 || wave.free === 0) continue;
    const [playDate, slotIndexRaw] = key.split(":");
    const slotIndex = Number(slotIndexRaw);
    const hasLater = [...laterBusy].some((busyKey) => {
      const [date, indexRaw] = busyKey.split(":");
      return date === playDate && Number(indexRaw) > slotIndex;
    });
    if (hasLater && wave.busy < courtCount) holes += 1;
  }
  return holes;
}

function pickSlot(params: {
  resources: ResourceSlot[];
  occupied: Set<string>;
  pairBusy: Map<string, Set<string>>;
  pairDates: Map<string, Set<string>>;
  courtCount: number;
  pair1?: FixturePairInput;
  pair2?: FixturePairInput;
  /// Si true, ignora preferencias de celda (solo día/ocupación) — útil para G/G y P/P.
  relaxPreferences?: boolean;
  /// G/G y P/P: solo slots posteriores a ambas aperturas de la zona.
  afterBound?: SlotBound | null;
}): SlotPick | null {
  const {
    resources,
    occupied,
    pairBusy,
    pairDates,
    courtCount,
    pair1,
    pair2,
    relaxPreferences = false,
    afterBound = null,
  } = params;

  const hardValid: ResourceSlot[] = [];
  for (const slot of resources) {
    if (
      afterBound &&
      !isSlotAfterBound(
        { playDate: slot.playDate, slotIndex: slot.slotIndex },
        afterBound,
      )
    ) {
      continue;
    }
    if (
      occupied.has(resourceKey(slot.playDate, slot.courtIndex, slot.startTime))
    ) {
      continue;
    }
    if (pairHardConflict(pair1, pairBusy, slot)) continue;
    if (pairHardConflict(pair2, pairBusy, slot)) continue;
    hardValid.push(slot);
  }
  if (hardValid.length === 0) return null;

  let earliest = hardValid[0]!;
  for (const slot of hardValid) {
    if (
      compareSlotBounds(
        { playDate: slot.playDate, slotIndex: slot.slotIndex },
        { playDate: earliest.playDate, slotIndex: earliest.slotIndex },
      ) < 0
    ) {
      earliest = slot;
    }
  }

  const wave = hardValid.filter(
    (slot) =>
      slot.playDate === earliest.playDate &&
      slot.slotIndex === earliest.slotIndex,
  );

  let best = wave[0]!;
  let bestScore = -Infinity;
  for (const slot of wave) {
    const score = scoreSlot(
      slot,
      pair1,
      pair2,
      pairBusy,
      pairDates,
      occupied,
      courtCount,
      false,
    );
    if (score > bestScore) {
      bestScore = score;
      best = slot;
    }
  }

  return {
    slot: best,
    ruleBreaks: collectRuleBreaks(
      best,
      pair1,
      pair2,
      pairBusy,
      pairDates,
      relaxPreferences,
    ),
  };
}

type PairAppearance = {
  match: ScheduledZoneMatch;
  playDate: string;
  slotIndex: number;
};

function flagNoRestGapFromAppearances(
  appearances: Map<string, PairAppearance[]>,
): number {
  const flagged = new Set<ScheduledZoneMatch>();
  for (const list of appearances.values()) {
    const byDate = new Map<string, PairAppearance[]>();
    for (const entry of list) {
      const day = byDate.get(entry.playDate) ?? [];
      day.push(entry);
      byDate.set(entry.playDate, day);
    }
    for (const dayList of byDate.values()) {
      dayList.sort((a, b) => a.slotIndex - b.slotIndex);
      for (let i = 1; i < dayList.length; i++) {
        const prev = dayList[i - 1]!;
        const cur = dayList[i]!;
        if (cur.slotIndex - prev.slotIndex <= ZONE_PAIR_REST_SLOTS) {
          flagged.add(prev.match);
          flagged.add(cur.match);
        }
      }
    }
  }
  for (const match of flagged) {
    match.noRestGap = true;
  }
  return flagged.size;
}

function markScheduled(
  slot: ResourceSlot,
  pairIds: Array<string | null | undefined>,
  occupied: Set<string>,
  pairBusy: Map<string, Set<string>>,
  pairDates: Map<string, Set<string>>,
  appearances: Map<string, PairAppearance[]>,
  match: ScheduledZoneMatch,
) {
  occupied.add(resourceKey(slot.playDate, slot.courtIndex, slot.startTime));
  for (const pairId of pairIds) {
    if (!pairId) continue;
    const busy = pairBusy.get(pairId) ?? new Set<string>();
    busy.add(pairBusyKey(slot.playDate, slot.slotIndex));
    busy.add(pairTimeKey(slot.playDate, slot.startTime));
    pairBusy.set(pairId, busy);
    const dates = pairDates.get(pairId) ?? new Set<string>();
    dates.add(slot.playDate);
    pairDates.set(pairId, dates);
    const list = appearances.get(pairId) ?? [];
    list.push({
      match,
      playDate: slot.playDate,
      slotIndex: slot.slotIndex,
    });
    appearances.set(pairId, list);
  }
}

/**
 * Arma zonas y programa partidos (día / horario / cancha) según preferencias.
 * - Zona 3: round-robin.
 * - Zona 4: apertura + ganador/ganador + perdedor/perdedor (sin parejas en 2.ª ronda).
 */
export function buildZonesFixture(
  input: BuildZonesFixtureInput,
): ZonesFixtureResult {
  const warnings: string[] = [];
  const pairById = new Map(input.pairs.map((p) => [p.id, p]));

  if (input.pairs.length === 0) {
    return {
      zones: [],
      warnings: ["No hay parejas con compañero para armar zonas."],
      unassignedPairIds: [],
      builtAt: new Date().toISOString(),
    };
  }

  const { zones: assigned, unassigned } = assignPairsToZones(
    input.pairs,
    input.pairsPerZone,
  );

  if (unassigned.length > 0) {
    warnings.push(
      `${unassigned.length} pareja(s) quedaron sin zona (tamaño de grupo).`,
    );
  }

  const resources = buildResourceSlots(input);
  if (resources.length === 0) {
    warnings.push(
      "No hay franjas horarias en días de fase de zonas. Revisá la configuración.",
    );
  }

  const occupied = new Set<string>();
  seedOccupiedFromReserved(
    occupied,
    resources,
    input.reservedSlots ?? [],
    input.playDays,
  );
  const pairBusy = new Map<string, Set<string>>();
  const pairDates = new Map<string, Set<string>>();
  const appearances = new Map<string, PairAppearance[]>();
  const courtCount = Math.max(1, input.courtCount);

  type ZoneJob = {
    label: string;
    pairIds: string[];
    pairings: ReturnType<typeof zonePairings<string>>;
    matches: ScheduledZoneMatch[];
  };

  // Trabajos por zona; se programan intercalados (1.er partido de cada zona,
  // luego el 2.º, …) para llenar canchas en paralelo.
  const jobs: ZoneJob[] = assigned.map((zone) => ({
    label: zone.label,
    pairIds: zone.pairIds,
    pairings: zonePairings(zone.pairIds),
    matches: [],
  }));

  const maxRounds = jobs.reduce(
    (max, job) => Math.max(max, job.pairings.length),
    0,
  );

  for (let round = 0; round < maxRounds; round++) {
    for (const job of jobs) {
      const pairing = job.pairings[round];
      if (!pairing) continue;

      const pair1 = pairing.pair1 ? pairById.get(pairing.pair1) : undefined;
      const pair2 = pairing.pair2 ? pairById.get(pairing.pair2) : undefined;
      const isFollowUp =
        pairing.kind === "winners" || pairing.kind === "losers";
      const afterBound = isFollowUp
        ? latestScheduledOpeningBound(job.matches)
        : null;

      if (isFollowUp && !afterBound) {
        warnings.push(
          `${job.label} partido ${round + 1}: sin horario posterior a las aperturas.`,
        );
        job.matches.push({
          matchIndex: round,
          kind: pairing.kind,
          playDate: null,
          startTime: null,
          endTime: null,
          courtIndex: null,
          pair1Id: pairing.pair1,
          pair2Id: pairing.pair2,
          slotIndex: null,
          noRestGap: false,
        });
        continue;
      }

      const softPair1 = isFollowUp
        ? pairById.get(job.pairIds[0]!)
        : pair1;
      const softPair2 = isFollowUp
        ? pairById.get(job.pairIds[1]!)
        : pair2;

      const picked = pickSlot({
        resources,
        occupied,
        pairBusy,
        pairDates,
        courtCount,
        pair1: softPair1,
        pair2: softPair2,
        relaxPreferences: isFollowUp,
        afterBound,
      });

      if (!picked) {
        warnings.push(
          isFollowUp
            ? `${job.label} partido ${round + 1}: sin horario posterior a las aperturas.`
            : `${job.label} partido ${round + 1}: sin horario disponible.`,
        );
        job.matches.push({
          matchIndex: round,
          kind: pairing.kind,
          playDate: null,
          startTime: null,
          endTime: null,
          courtIndex: null,
          pair1Id: pairing.pair1,
          pair2Id: pairing.pair2,
          slotIndex: null,
          noRestGap: false,
        });
        continue;
      }

      const { slot, ruleBreaks } = picked;

      const scheduled: ScheduledZoneMatch = {
        matchIndex: round,
        kind: pairing.kind,
        playDate: slot.playDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        courtIndex: slot.courtIndex,
        pair1Id: pairing.pair1,
        pair2Id: pairing.pair2,
        slotIndex: slot.slotIndex,
        noRestGap: ruleBreaks.includes("rest"),
        ruleBreaks,
      };

      markScheduled(
        slot,
        isFollowUp ? job.pairIds : [pairing.pair1, pairing.pair2],
        occupied,
        pairBusy,
        pairDates,
        appearances,
        scheduled,
      );

      job.matches.push(scheduled);
    }
  }

  const dayOpenByDate = new Map(
    input.playDays.filter((d) => d.date).map((d) => [d.date, d.startTime]),
  );

  const scheduledZones: ScheduledZone[] = jobs.map((job) => {
    const matches = [...job.matches].sort((a, b) =>
      comparePlayDaySchedule(a, b, dayOpenByDate),
    );
    for (let i = 0; i < matches.length; i++) {
      matches[i]!.matchIndex = i;
    }
    return {
      label: job.label,
      pairIds: job.pairIds,
      matches,
    };
  });

  const noRestCount = flagNoRestGapFromAppearances(appearances);
  if (noRestCount > 0) {
    warnings.push(
      `${noRestCount} partido(s) sin celda de descanso entre turnos de una pareja (marcados para revisión manual).`,
    );
  }

  const allMatches = scheduledZones.flatMap((zone) => zone.matches);
  const dayPrefBreaks = allMatches.filter((match) =>
    match.ruleBreaks?.includes("day_pref"),
  ).length;
  const cellPrefBreaks = allMatches.filter((match) =>
    match.ruleBreaks?.includes("cell_pref"),
  ).length;
  if (dayPrefBreaks > 0) {
    warnings.push(
      `${dayPrefBreaks} partido(s) fuera de preferencia de día (la oleada tuvo prioridad; solo informativo).`,
    );
  }
  if (cellPrefBreaks > 0) {
    warnings.push(
      `${cellPrefBreaks} partido(s) fuera de preferencia de horario (la oleada tuvo prioridad; solo informativo).`,
    );
  }

  const withoutPrefs = input.pairs.filter((p) => p.preferences.length === 0);
  if (withoutPrefs.length > 0) {
    warnings.push(
      `${withoutPrefs.length} pareja(s) sin rangos de preferencia: se ubicaron en los huecos libres.`,
    );
  }

  const oleadaHoles = leftoverOleadaHoleCount(resources, occupied, courtCount);
  if (oleadaHoles > 0) {
    warnings.push(
      `${oleadaHoles} franja(s) con cancha libre y partidos más tarde (oleada incompleta: pareja ocupada o G/G).`,
    );
  }

  return {
    zones: scheduledZones,
    warnings,
    unassignedPairIds: unassigned,
    builtAt: new Date().toISOString(),
  };
}
