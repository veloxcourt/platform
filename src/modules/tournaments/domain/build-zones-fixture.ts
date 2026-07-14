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

export type BuildZonesFixtureInput = {
  pairs: FixturePairInput[];
  pairsPerZone: number;
  playDays: PlayDayValues[];
  zonesPlayDates: string[];
  courtCount: number;
  slotMinutes: number;
};

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

/**
 * Prioridad de scoring (de mayor a menor):
 * 1. Respetar descanso (incluso en modo semi-duro: preferir huecos con gap)
 * 2. Preferencias de celda
 * 3. Repartir en otro día cuando la preferencia lo permite (ANY / DIFFERENT_DAYS)
 * 4. Horario más temprano + completar oleada en paralelo
 * 5. Desempate por cancha
 *
 * El intercalado de canchas NUNCA debe ganar al descanso.
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

  // 4) Horario temprano + oleada en paralelo (solo entre candidatos ya válidos).
  score -= slot.slotIndex * 10_000;

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
}): ResourceSlot | null {
  const {
    resources,
    occupied,
    pairBusy,
    pairDates,
    courtCount,
    pair1,
    pair2,
    relaxPreferences = false,
  } = params;

  // Semi-duro: primero con descanso; si no hay hueco, permitir slots seguidos
  // (pero el score sigue prefiriendo huecos con descanso).
  const restAttempts = [true, false];
  const prefAttempts: Array<{ relaxPrefs: boolean; relaxDay: boolean }> = [
    { relaxPrefs: relaxPreferences, relaxDay: false },
    { relaxPrefs: true, relaxDay: false },
    { relaxPrefs: true, relaxDay: true },
  ];

  for (const requireRest of restAttempts) {
    for (const attempt of prefAttempts) {
      let best: ResourceSlot | null = null;
      let bestScore = -Infinity;

      for (const slot of resources) {
        if (
          occupied.has(
            resourceKey(slot.playDate, slot.courtIndex, slot.startTime),
          )
        ) {
          continue;
        }

        const checkPair = (
          pair: FixturePairInput | undefined,
        ): boolean => {
          if (!pair) return true;
          if (
            pairSlotConflicts(
              pairBusy.get(pair.id),
              slot.playDate,
              slot.slotIndex,
              slot.startTime,
              requireRest,
            )
          ) {
            return false;
          }
          if (!attempt.relaxDay) {
            const dates = pairDates.get(pair.id) ?? new Set<string>();
            if (!dayPrefAllows(pair.zonesDayPreference, dates, slot.playDate)) {
              return false;
            }
          }
          if (!attempt.relaxPrefs && pair.preferences.length > 0) {
            if (
              !preferenceKeys(pair).has(
                prefKey(slot.playDate, slot.slotIndex),
              )
            ) {
              return false;
            }
          }
          return true;
        };

        if (!checkPair(pair1) || !checkPair(pair2)) continue;

        const score = scoreSlot(
          slot,
          pair1,
          pair2,
          pairBusy,
          pairDates,
          occupied,
          courtCount,
          requireRest,
        );
        if (score > bestScore) {
          bestScore = score;
          best = slot;
        }
      }

      if (best) return best;
    }
  }

  return null;
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

      const softPair1 = isFollowUp
        ? pairById.get(job.pairIds[0]!)
        : pair1;
      const softPair2 = isFollowUp
        ? pairById.get(job.pairIds[1]!)
        : pair2;

      const slot = pickSlot({
        resources,
        occupied,
        pairBusy,
        pairDates,
        courtCount,
        pair1: softPair1,
        pair2: softPair2,
        relaxPreferences: isFollowUp,
      });

      if (!slot) {
        warnings.push(
          `${job.label} partido ${round + 1}: sin horario disponible.`,
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
        noRestGap: false,
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

  const withoutPrefs = input.pairs.filter((p) => p.preferences.length === 0);
  if (withoutPrefs.length > 0) {
    warnings.push(
      `${withoutPrefs.length} pareja(s) sin rangos de preferencia: se ubicaron en los huecos libres.`,
    );
  }

  return {
    zones: scheduledZones,
    warnings,
    unassignedPairIds: unassigned,
    builtAt: new Date().toISOString(),
  };
}
