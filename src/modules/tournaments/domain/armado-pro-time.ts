import { ZONE_PAIR_REST_SLOTS } from "./build-zones-fixture";
import { zonePairings, type ZonePairing } from "./zone-bracket";
import type { ZonesDayPreference } from "./zones-day-preference";

/// Celda de preferencia horaria (día + franja), igual que en el armado automático.
export type PreferenceCell = {
  key: string;
  playDate: string;
  slotIndex: number;
  startTime: string;
  endTime: string;
};

export type PairPreferenceCells = Map<string, Map<string, PreferenceCell>>;

function cellKey(playDate: string, slotIndex: number) {
  return `${playDate}:${slotIndex}`;
}

function compareCells(left: PreferenceCell, right: PreferenceCell) {
  if (left.playDate !== right.playDate) {
    return left.playDate.localeCompare(right.playDate);
  }
  return left.slotIndex - right.slotIndex;
}

export function preferenceCellsByPair(
  reservations: Array<{
    pairId: string;
    playDate: string;
    slotIndex: number;
    startTime: string;
    endTime: string;
  }>,
): PairPreferenceCells {
  const byPair: PairPreferenceCells = new Map();
  for (const reservation of reservations) {
    const key = cellKey(reservation.playDate, reservation.slotIndex);
    const cells = byPair.get(reservation.pairId) ?? new Map();
    cells.set(key, {
      key,
      playDate: reservation.playDate,
      slotIndex: reservation.slotIndex,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
    });
    byPair.set(reservation.pairId, cells);
  }
  return byPair;
}

export function pairHasPreferences(
  cells: PairPreferenceCells,
  pairId: string,
): boolean {
  return (cells.get(pairId)?.size ?? 0) > 0;
}

/// Celdas donde el partido respeta la preferencia de ambas parejas.
/// `null`: ninguna de las dos cargó preferencias (vale cualquier horario).
function matchCells(
  cells: PairPreferenceCells,
  left: string,
  right: string,
): PreferenceCell[] | null {
  const a = cells.get(left);
  const b = cells.get(right);
  if (!a?.size && !b?.size) return null;
  if (!a?.size) return [...b!.values()];
  if (!b?.size) return [...a.values()];
  return [...a.values()].filter((cell) => b.has(cell.key));
}

export function pairsShareTime(
  cells: PairPreferenceCells,
  left: string,
  right: string,
): boolean {
  const shared = matchCells(cells, left, right);
  return shared === null || shared.length > 0;
}

export type PreferenceGroup = {
  pairIds: string[];
  /// Franjas que comparten todas las parejas del grupo.
  cells: PreferenceCell[];
};

/// Agrupa por la franja que más parejas eligieron: todas las del grupo
/// pueden jugar entre sí en esa franja. Las parejas sin preferencias no
/// entran en ningún grupo (juegan en cualquier horario).
export function groupPairsByPreference(
  pairIds: string[],
  cells: PairPreferenceCells,
): PreferenceGroup[] {
  let pending = pairIds.filter((id) => pairHasPreferences(cells, id));
  const groups: PreferenceGroup[] = [];

  while (pending.length > 0) {
    const count = new Map<string, { cell: PreferenceCell; n: number }>();
    for (const id of pending) {
      for (const cell of cells.get(id)!.values()) {
        const entry = count.get(cell.key) ?? { cell, n: 0 };
        entry.n += 1;
        count.set(cell.key, entry);
      }
    }
    let best: { cell: PreferenceCell; n: number } | null = null;
    for (const entry of count.values()) {
      if (
        !best ||
        entry.n > best.n ||
        (entry.n === best.n && compareCells(entry.cell, best.cell) < 0)
      ) {
        best = entry;
      }
    }
    const members = pending.filter((id) => cells.get(id)!.has(best!.cell.key));
    const first = cells.get(members[0]!)!;
    const shared = [...first.values()]
      .filter((cell) => members.every((id) => cells.get(id)!.has(cell.key)))
      .sort(compareCells);
    groups.push({ pairIds: members, cells: shared });
    const memberSet = new Set(members);
    pending = pending.filter((id) => !memberSet.has(id));
  }

  return groups;
}

export type ZoneTimeCheck =
  | { kind: "ok" }
  | { kind: "incomplete" }
  /// Posiciones (0-based) que tienen que jugar entre sí y no comparten horario.
  | { kind: "missing"; pairings: Array<[number, number]> }
  /// Comparten horario de a dos, pero no alcanza para los 3 partidos
  /// respetando descanso y preferencia de día.
  | { kind: "crowded" };

function cellsClash(left: PreferenceCell, right: PreferenceCell) {
  return (
    left.playDate === right.playDate &&
    Math.abs(left.slotIndex - right.slotIndex) <= ZONE_PAIR_REST_SLOTS
  );
}

function dayPreferenceHolds(
  preference: ZonesDayPreference | undefined,
  left: PreferenceCell,
  right: PreferenceCell,
) {
  if (preference === "SAME_DAY") return left.playDate === right.playDate;
  if (preference === "DIFFERENT_DAYS") return left.playDate !== right.playDate;
  return true;
}

/// Zona de 3: busca una franja por partido de modo que cada pareja tenga
/// descanso entre sus dos partidos y se respete su preferencia de día.
function roundRobinFits(
  slots: string[],
  options: Array<{ positions: [number, number]; cells: PreferenceCell[] | null }>,
  dayPreferenceByPair: Map<string, ZonesDayPreference>,
): boolean {
  const picked: Array<PreferenceCell | null> = [];

  function consistent(matchIndex: number): boolean {
    const cell = picked[matchIndex];
    if (!cell) return true;
    const [a, b] = options[matchIndex]!.positions;
    for (let other = 0; other < matchIndex; other++) {
      const otherCell = picked[other];
      if (!otherCell) continue;
      const [c, d] = options[other]!.positions;
      for (const position of [a, b]) {
        if (position !== c && position !== d) continue;
        if (cellsClash(cell, otherCell)) return false;
        const preference = dayPreferenceByPair.get(slots[position]!);
        if (!dayPreferenceHolds(preference, cell, otherCell)) return false;
      }
    }
    return true;
  }

  function search(matchIndex: number): boolean {
    if (matchIndex === options.length) return true;
    const candidates = options[matchIndex]!.cells;
    if (candidates === null) {
      picked[matchIndex] = null;
      return search(matchIndex + 1);
    }
    for (const cell of candidates) {
      picked[matchIndex] = cell;
      if (consistent(matchIndex) && search(matchIndex + 1)) return true;
    }
    picked[matchIndex] = null;
    return false;
  }

  return search(0);
}

/// Mismos cruces que programa el armado: en zonas de 4 solo la 1.ª ronda
/// usa preferencias (G/G y P/P se programan sin ellas).
export function zoneTimeCheck(
  slots: Array<string | null>,
  cells: PairPreferenceCells,
  dayPreferenceByPair: Map<string, ZonesDayPreference>,
): ZoneTimeCheck {
  const pairings = zonePairings(slots.map((_, index) => index)).filter(
    (pairing): pairing is ZonePairing<number> & { pair1: number; pair2: number } =>
      pairing.pair1 !== null && pairing.pair2 !== null,
  );
  const missing: Array<[number, number]> = [];
  const options: Array<{
    positions: [number, number];
    cells: PreferenceCell[] | null;
  }> = [];
  for (const pairing of pairings) {
    const left = slots[pairing.pair1];
    const right = slots[pairing.pair2];
    if (!left || !right) continue;
    const shared = matchCells(cells, left, right);
    if (shared !== null && shared.length === 0) {
      missing.push([pairing.pair1, pairing.pair2]);
      continue;
    }
    options.push({ positions: [pairing.pair1, pairing.pair2], cells: shared });
  }

  if (missing.length > 0) return { kind: "missing", pairings: missing };
  const complete = slots.every((id) => id !== null);
  if (!complete) return { kind: "incomplete" };
  if (
    slots.length === 3 &&
    !roundRobinFits(slots as string[], options, dayPreferenceByPair)
  ) {
    return { kind: "crowded" };
  }
  return { kind: "ok" };
}
