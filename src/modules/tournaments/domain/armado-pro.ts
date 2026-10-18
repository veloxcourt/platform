import { z } from "zod";

import { readMatchScores } from "./match-scores";
import { rebuildZoneKeepingSchedules } from "./reshape-zones-manual";
import { distributeZoneSizes } from "./simulate-category-schedule";
import { zoneLabelFromIndex, zoneLetterFromLabel } from "./zone-bracket";
import type { ZonesFixturePersisted } from "./zones-fixture-schema";

/// Armado Pro: tablero donde cada zona tiene lugares fijos y un auxiliar
/// guarda las parejas que quedan afuera.
export type ArmadoProZone = {
  key: string;
  letter: string;
  slots: Array<string | null>;
  /// Con resultados cargados: no se mueven sus parejas ni cambia su letra.
  locked: boolean;
};

export type ArmadoProBoard = {
  zones: ArmadoProZone[];
  aux: string[];
};

export type ArmadoProSource =
  | { kind: "slot"; zoneKey: string; index: number }
  | { kind: "aux"; pairId: string };

export type ArmadoProTarget =
  | { kind: "slot"; zoneKey: string; index: number }
  | { kind: "zone"; zoneKey: string }
  | { kind: "aux" };

export type ArmadoProMoveResult =
  | { ok: true; board: ArmadoProBoard; displacedPairId: string | null }
  | { ok: false; error: string };

export const armadoProLayoutSchema = z.object({
  zones: z.array(
    z.object({
      label: z.string().trim().min(1),
      pairIds: z.array(z.string().min(1)),
    }),
  ),
  unassignedPairIds: z.array(z.string().min(1)),
});

export type ArmadoProLayout = z.infer<typeof armadoProLayoutSchema>;

export function zoneHasScores(zone: {
  matches: Array<{ scores?: unknown }>;
}): boolean {
  return zone.matches.some((match) => {
    const scores = readMatchScores(match.scores);
    return Boolean(
      scores && Object.values(scores).some((value) => value !== ""),
    );
  });
}

export function armadoProZoneLabel(letter: string): string {
  return `Zona ${letter}`;
}

/// Letras válidas para N zonas: A, B, C… (las llaves cruzan por letra).
export function armadoProLetterOptions(zoneCount: number): string[] {
  return Array.from({ length: zoneCount }, (_, index) =>
    zoneLetterFromLabel(zoneLabelFromIndex(index)),
  );
}

/// Arma el tablero con el formato 3/4 que corresponde a las parejas
/// Parcial o Confirmado. Lo que no entra queda en el auxiliar.
export function buildArmadoProBoard(params: {
  zones: Array<{
    label: string;
    pairIds: string[];
    matches: Array<{ scores?: unknown }>;
  }>;
  eligiblePairIds: string[];
  pairsPerZone: number;
}): ArmadoProBoard {
  const eligible = [...new Set(params.eligiblePairIds)];
  const eligibleSet = new Set(eligible);
  const placed = new Set<string>();
  const aux: string[] = [];

  const existingByLetter = new Map<string, (typeof params.zones)[number]>();
  for (const zone of params.zones) {
    const letter = zoneLetterFromLabel(zone.label);
    if (!existingByLetter.has(letter)) existingByLetter.set(letter, zone);
  }

  const lockedLetters = new Set<string>();
  for (const [letter, zone] of existingByLetter) {
    if (!zoneHasScores(zone)) continue;
    lockedLetters.add(letter);
    for (const id of zone.pairIds) placed.add(id);
  }

  const zones: ArmadoProZone[] = [];
  const usedLetters = new Set<string>();
  const sizes = distributeZoneSizes(eligible.length, params.pairsPerZone || 3);
  sizes.forEach((size, index) => {
    const letter = zoneLetterFromLabel(zoneLabelFromIndex(index));
    usedLetters.add(letter);
    const existing = existingByLetter.get(letter);
    if (existing && lockedLetters.has(letter)) {
      zones.push({
        key: `zone-${letter}`,
        letter,
        slots: [...existing.pairIds],
        locked: true,
      });
      return;
    }
    const slots: Array<string | null> = Array.from({ length: size }, () => null);
    let cursor = 0;
    for (const id of existing?.pairIds ?? []) {
      if (!eligibleSet.has(id) || placed.has(id)) continue;
      placed.add(id);
      if (cursor < size) slots[cursor++] = id;
      else aux.push(id);
    }
    zones.push({ key: `zone-${letter}`, letter, slots, locked: false });
  });

  for (const [letter, zone] of existingByLetter) {
    if (usedLetters.has(letter)) continue;
    if (lockedLetters.has(letter)) {
      zones.push({
        key: `zone-${letter}`,
        letter,
        slots: [...zone.pairIds],
        locked: true,
      });
      continue;
    }
    for (const id of zone.pairIds) {
      if (!eligibleSet.has(id) || placed.has(id)) continue;
      placed.add(id);
      aux.push(id);
    }
  }

  for (const id of eligible) {
    if (placed.has(id)) continue;
    placed.add(id);
    aux.push(id);
  }

  return { zones, aux };
}

export type ArmadoProIssues = {
  /// Letra repetida o zona de 4 fuera de las primeras letras.
  letterErrors: Map<string, string>;
  incompleteZoneKeys: Set<string>;
};

function joinLetters(letters: string[]): string {
  if (letters.length <= 1) return letters[0] ?? "";
  return `${letters.slice(0, -1).join(", ")} o ${letters[letters.length - 1]}`;
}

export function armadoProIssues(board: ArmadoProBoard): ArmadoProIssues {
  const letterErrors = new Map<string, string>();
  const incompleteZoneKeys = new Set<string>();

  const letterCount = new Map<string, number>();
  for (const zone of board.zones) {
    letterCount.set(zone.letter, (letterCount.get(zone.letter) ?? 0) + 1);
    if (!zone.locked && zone.slots.some((slot) => slot === null)) {
      incompleteZoneKeys.add(zone.key);
    }
  }
  for (const zone of board.zones) {
    if ((letterCount.get(zone.letter) ?? 0) > 1) {
      letterErrors.set(zone.key, `Letra ${zone.letter} repetida`);
    }
  }

  // Las zonas más grandes van primero: en FAP los 3.° salen de A y B.
  const letters = armadoProLetterOptions(board.zones.length);
  const sizesDesc = board.zones
    .map((zone) => zone.slots.length)
    .sort((left, right) => right - left);
  const lettersBySize = new Map<number, string[]>();
  sizesDesc.forEach((size, index) => {
    const list = lettersBySize.get(size) ?? [];
    list.push(letters[index]!);
    lettersBySize.set(size, list);
  });
  for (const zone of board.zones) {
    if (letterErrors.has(zone.key)) continue;
    const expected = lettersBySize.get(zone.slots.length) ?? [];
    if (!expected.includes(zone.letter)) {
      letterErrors.set(
        zone.key,
        `Zona de ${zone.slots.length}: va en ${joinLetters(expected)}`,
      );
    }
  }

  return { letterErrors, incompleteZoneKeys };
}

function cloneBoard(board: ArmadoProBoard): ArmadoProBoard {
  return {
    zones: board.zones.map((zone) => ({ ...zone, slots: [...zone.slots] })),
    aux: [...board.aux],
  };
}

function lockedError(zone: ArmadoProZone): ArmadoProMoveResult {
  return {
    ok: false,
    error: `${armadoProZoneLabel(zone.letter)} tiene resultados cargados: no se pueden mover sus parejas.`,
  };
}

/// Soltar sobre una pareja de otra zona la reemplaza y la pisada va al
/// auxiliar. Dentro de la misma zona intercambian lugar (1.ª ronda).
export function moveArmadoProPair(
  board: ArmadoProBoard,
  source: ArmadoProSource,
  target: ArmadoProTarget,
): ArmadoProMoveResult {
  const next = cloneBoard(board);
  const zoneByKey = new Map(next.zones.map((zone) => [zone.key, zone]));
  const unchanged: ArmadoProMoveResult = {
    ok: true,
    board,
    displacedPairId: null,
  };

  const sourceZone =
    source.kind === "slot" ? zoneByKey.get(source.zoneKey) : undefined;
  if (source.kind === "slot" && !sourceZone) return unchanged;
  const pairId =
    source.kind === "aux" ? source.pairId : sourceZone!.slots[source.index];
  if (!pairId) return unchanged;
  if (sourceZone?.locked) return lockedError(sourceZone);

  if (target.kind === "aux") {
    if (!sourceZone || source.kind !== "slot") return unchanged;
    sourceZone.slots[source.index] = null;
    next.aux.unshift(pairId);
    return { ok: true, board: next, displacedPairId: null };
  }

  const targetZone = zoneByKey.get(target.zoneKey);
  if (!targetZone) return unchanged;
  if (targetZone.locked) return lockedError(targetZone);

  let index: number;
  if (target.kind === "zone") {
    if (sourceZone && sourceZone.key === targetZone.key) return unchanged;
    index = targetZone.slots.indexOf(null);
    if (index < 0) {
      return {
        ok: false,
        error: `${armadoProZoneLabel(targetZone.letter)} está completa: soltá la pareja sobre otra para reemplazarla.`,
      };
    }
  } else {
    index = target.index;
    if (index < 0 || index >= targetZone.slots.length) return unchanged;
  }

  if (source.kind === "slot" && sourceZone === targetZone) {
    if (source.index === index) return unchanged;
    const slots = targetZone.slots;
    [slots[source.index], slots[index]] = [
      slots[index] ?? null,
      slots[source.index] ?? null,
    ];
    return { ok: true, board: next, displacedPairId: null };
  }

  const displaced = targetZone.slots[index] ?? null;
  if (source.kind === "slot") sourceZone!.slots[source.index] = null;
  else next.aux = next.aux.filter((id) => id !== pairId);
  targetZone.slots[index] = pairId;
  if (displaced) next.aux.unshift(displaced);
  return { ok: true, board: next, displacedPairId: displaced };
}

export function setArmadoProZoneLetter(
  board: ArmadoProBoard,
  zoneKey: string,
  letter: string,
): ArmadoProBoard {
  return {
    ...board,
    zones: board.zones.map((zone) =>
      zone.key === zoneKey && !zone.locked ? { ...zone, letter } : zone,
    ),
  };
}

export function moveArmadoProZone(
  board: ArmadoProBoard,
  fromKey: string,
  toKey: string,
): ArmadoProBoard {
  const from = board.zones.findIndex((zone) => zone.key === fromKey);
  const to = board.zones.findIndex((zone) => zone.key === toKey);
  if (from < 0 || to < 0 || from === to) return board;
  const zones = [...board.zones];
  const [moved] = zones.splice(from, 1);
  zones.splice(to, 0, moved!);
  return { ...board, zones };
}

/// Las zonas vacías no se guardan; el orden del tablero sí.
export function armadoProLayoutFromBoard(board: ArmadoProBoard): ArmadoProLayout {
  return {
    zones: board.zones
      .map((zone) => ({
        label: armadoProZoneLabel(zone.letter),
        pairIds: zone.slots.filter((id): id is string => Boolean(id)),
      }))
      .filter((zone) => zone.pairIds.length > 0),
    unassignedPairIds: [...board.aux],
  };
}

function sameOrder(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

export type ApplyArmadoProResult =
  | {
      ok: true;
      fixture: ZonesFixturePersisted;
      unscheduledMatchCount: number;
      unassignedCount: number;
    }
  | { ok: false; error: string };

/// Las zonas que no cambian quedan intactas. En las que cambian, los cruces
/// nuevos quedan sin día, horario ni cancha.
export function applyArmadoProLayout(params: {
  previous: ZonesFixturePersisted | null | undefined;
  layout: ArmadoProLayout;
  eligiblePairIds: string[];
}): ApplyArmadoProResult {
  const eligible = new Set(params.eligiblePairIds);
  const previousZones = params.previous?.zones ?? [];
  const previousByLabel = new Map(
    previousZones.map((zone) => [zone.label, zone]),
  );

  const labels = new Set<string>();
  const placed = new Set<string>();
  for (const zone of params.layout.zones) {
    if (labels.has(zone.label)) {
      return { ok: false, error: `${zone.label} está repetida.` };
    }
    labels.add(zone.label);
    for (const id of zone.pairIds) {
      if (placed.has(id)) {
        return { ok: false, error: "Una pareja quedó en dos zonas." };
      }
      placed.add(id);
    }
  }

  const lockedZones = previousZones.filter(zoneHasScores);
  const lockedPairIds = new Set(lockedZones.flatMap((zone) => zone.pairIds));
  for (const locked of lockedZones) {
    const next = params.layout.zones.find((zone) => zone.label === locked.label);
    if (!next || !sameOrder(next.pairIds, locked.pairIds)) {
      return {
        ok: false,
        error: `${locked.label} tiene resultados cargados: no se pueden mover sus parejas.`,
      };
    }
  }
  for (const id of placed) {
    if (!eligible.has(id) && !lockedPairIds.has(id)) {
      return {
        ok: false,
        error:
          "Hay parejas que ya no están Parcial o Confirmado. Volvé a abrir Armado Pro.",
      };
    }
  }

  const allPreviousMatches = previousZones.flatMap((zone) => zone.matches);
  let unscheduledMatchCount = 0;
  const zones = params.layout.zones.map((zone) => {
    const previous = previousByLabel.get(zone.label);
    if (previous && sameOrder(previous.pairIds, zone.pairIds)) return previous;
    const rebuilt = rebuildZoneKeepingSchedules({
      label: zone.label,
      pairIds: zone.pairIds,
      preferred: previous?.matches ?? [],
      fallback: allPreviousMatches,
    });
    unscheduledMatchCount += rebuilt.matches.filter(
      (match) => !match.playDate || !match.startTime,
    ).length;
    return rebuilt;
  });

  const unassigned = [
    ...new Set([...params.layout.unassignedPairIds, ...params.eligiblePairIds]),
  ].filter((id) => eligible.has(id) && !placed.has(id));

  const warnings: string[] = [];
  if (unassigned.length > 0) {
    warnings.push(`${unassigned.length} pareja(s) quedaron sin zona.`);
  }
  if (unscheduledMatchCount > 0) {
    warnings.push(
      `${unscheduledMatchCount} partido(s) sin día, horario ni cancha.`,
    );
  }

  return {
    ok: true,
    fixture: {
      zones,
      warnings,
      unassignedPairIds: unassigned,
      builtAt: new Date().toISOString(),
    },
    unscheduledMatchCount,
    unassignedCount: unassigned.length,
  };
}
