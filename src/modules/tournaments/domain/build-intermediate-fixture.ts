import { timeToMinutes } from "@/modules/bookings/domain/rules";
import { buildEmptyCourtDaySlots } from "./court-day-slots";
import type { PlayDayValues } from "./config-schema";
import type { FinalPhaseStartRound } from "./config-schema";
import { ZONE_PAIR_REST_SLOTS } from "./build-zones-fixture";
import {
  buildFinalOfficialRounds,
  buildIntermediateOfficialRounds,
  categoryHasFinalPhase,
  categoryHasIntermediatePhase,
} from "./intermediate-phase";

export type IntermediateScheduledMatch = {
  officialId: number;
  roundLabel: string;
  matchIndex: number;
  left: string;
  right: string;
  playDate: string | null;
  startTime: string | null;
  endTime?: string | null;
  courtIndex: number | null;
  slotIndex?: number | null;
  noRestGap?: boolean;
};

export type IntermediateFixtureRound = {
  label: string;
  matches: IntermediateScheduledMatch[];
};

export type IntermediateFixtureCategoryResult = {
  categoryId: string;
  rounds: IntermediateFixtureRound[];
  warnings: string[];
  builtAt: string;
};

export type IntermediateFixtureResult = {
  categories: IntermediateFixtureCategoryResult[];
  warnings: string[];
  builtAt: string;
};

type ZoneMatchStamp = {
  playDate: string | null;
  startTime: string | null;
  endTime?: string | null;
  courtIndex: number | null;
  slotIndex?: number | null;
};

export type BuildIntermediateCategoryInput = {
  categoryId: string;
  pairCount: number;
  zone4Advancers: 2 | 3;
  startsAtRound: FinalPhaseStartRound;
  zonesFixtureMatches: ZoneMatchStamp[];
};

export type BuildIntermediateFixtureInput = {
  playDays: PlayDayValues[];
  courtCount: number;
  slotMinutes: number;
  categories: BuildIntermediateCategoryInput[];
  /// Canchas/horarios ya tomados (otras categorías), para no pisarlos.
  reservedMatches?: ZoneMatchStamp[];
  /// Duración real del partido por instancia (Cuartos 60, Semi 90, etc.).
  roundSlotMinutes?: (categoryId: string, roundLabel: string) => number;
};

export type BuildFinalCategoryInput = BuildIntermediateCategoryInput & {
  priorKnockoutMatches?: IntermediateScheduledMatch[];
};

export type BuildFinalFixtureInput = {
  playDays: PlayDayValues[];
  courtCount: number;
  slotMinutes: number;
  categories: BuildFinalCategoryInput[];
  /// Canchas/horarios ya tomados (otras categorías), para no pisarlos.
  reservedMatches?: ZoneMatchStamp[];
  /// Duración real del partido por instancia (Cuartos 60, Semi 90, etc.).
  roundSlotMinutes?: (categoryId: string, roundLabel: string) => number;
};

type ResourceSlot = {
  playDate: string;
  courtIndex: number;
  slotIndex: number;
  startTime: string;
  endTime: string;
};

type SlotBound = {
  playDate: string;
  slotIndex: number;
};

type PendingMatch = {
  categoryId: string;
  officialId: number;
  roundLabel: string;
  left: string;
  right: string;
};

function resourceKey(playDate: string, courtIndex: number, startTime: string) {
  return `${playDate}:${courtIndex}:${startTime}`;
}

function compareSlotBounds(a: SlotBound, b: SlotBound): number {
  if (a.playDate !== b.playDate) return a.playDate.localeCompare(b.playDate);
  return a.slotIndex - b.slotIndex;
}

function isSlotAfterBound(slot: SlotBound, bound: SlotBound): boolean {
  return compareSlotBounds(slot, bound) > 0;
}

function restBound(bound: SlotBound): SlotBound {
  return {
    playDate: bound.playDate,
    slotIndex: bound.slotIndex + ZONE_PAIR_REST_SLOTS,
  };
}

function laterBound(a: SlotBound | null, b: SlotBound | null): SlotBound | null {
  if (!a) return b;
  if (!b) return a;
  return compareSlotBounds(a, b) >= 0 ? a : b;
}

export function penultimatePlayDay(
  playDays: PlayDayValues[],
): PlayDayValues | null {
  const days = playDays.filter((day) => day.date);
  if (days.length < 2) return null;
  return days[days.length - 2] ?? null;
}

export function lastPlayDay(playDays: PlayDayValues[]): PlayDayValues | null {
  const days = playDays.filter((day) => day.date);
  return days[days.length - 1] ?? null;
}

function feederOfficialIds(left: string, right: string): number[] {
  const ids: number[] = [];
  for (const side of [left, right]) {
    const match = side.match(/Ganador n[°º]\s*(\d+)/i);
    if (match) ids.push(Number(match[1]));
  }
  return ids;
}

function latestZoneBound(
  matches: ZoneMatchStamp[],
  cellMinutes: number,
): SlotBound | null {
  let best: SlotBound | null = null;
  for (const match of matches) {
    if (!match.playDate) continue;
    const slotIndex = matchLastSlotIndex(match, cellMinutes);
    if (slotIndex == null) continue;
    best = laterBound(best, { playDate: match.playDate, slotIndex });
  }
  return best;
}

function buildDaySlots(
  day: PlayDayValues | null,
  courtCount: number,
  slotMinutes: number,
): {
  day: PlayDayValues | null;
  resources: ResourceSlot[];
} {
  if (!day) return { day: null, resources: [] };

  const courts = Math.max(1, courtCount);
  const slots = buildEmptyCourtDaySlots(
    { ...day, hasSlotSelection: false },
    courts,
    Math.max(1, slotMinutes),
  );
  const resources = slots
    .map((slot) => ({
      playDate: slot.playDate,
      courtIndex: slot.courtIndex,
      slotIndex: slot.slotIndex,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }))
    .sort((a, b) => {
      if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
      return a.courtIndex - b.courtIndex;
    });
  return { day, resources };
}

function buildPenultimateSlots(input: BuildIntermediateFixtureInput) {
  return buildDaySlots(
    penultimatePlayDay(input.playDays),
    input.courtCount,
    input.slotMinutes,
  );
}

function buildLastDaySlots(input: BuildFinalFixtureInput) {
  return buildDaySlots(
    lastPlayDay(input.playDays),
    input.courtCount,
    input.slotMinutes,
  );
}

function stampCellCount(
  match: Pick<ZoneMatchStamp, "startTime" | "endTime">,
  cellMinutes: number,
): number {
  if (!match.startTime || !match.endTime) return 1;
  const start = timeToMinutes(match.startTime);
  let end = timeToMinutes(match.endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(1, Math.ceil((end - start) / Math.max(1, cellMinutes)));
}

function matchLastSlotIndex(
  match: Pick<ZoneMatchStamp, "slotIndex" | "startTime" | "endTime">,
  cellMinutes: number,
): number | null {
  if (match.slotIndex == null) return null;
  return match.slotIndex + stampCellCount(match, cellMinutes) - 1;
}

function cellsNeededFor(duration: number, cellMinutes: number) {
  return Math.max(1, Math.ceil(duration / Math.max(1, cellMinutes)));
}

function consecutiveResources(
  resources: ResourceSlot[],
  start: ResourceSlot,
  cellsNeeded: number,
): ResourceSlot[] | null {
  const block = resources
    .filter(
      (resource) =>
        resource.playDate === start.playDate &&
        resource.courtIndex === start.courtIndex &&
        resource.slotIndex >= start.slotIndex &&
        resource.slotIndex < start.slotIndex + cellsNeeded,
    )
    .sort((a, b) => a.slotIndex - b.slotIndex);
  if (block.length < cellsNeeded) return null;
  return block;
}

function occupyBlock(occupied: Set<string>, block: ResourceSlot[]) {
  for (const slot of block) {
    occupied.add(resourceKey(slot.playDate, slot.courtIndex, slot.startTime));
  }
}

function occupyZoneSlots(
  occupied: Set<string>,
  resources: ResourceSlot[],
  matches: ZoneMatchStamp[],
  cellMinutes: number,
) {
  for (const match of matches) {
    if (!match.playDate || match.courtIndex == null || !match.startTime) {
      continue;
    }
    const start = resources.find(
      (resource) =>
        resource.playDate === match.playDate &&
        resource.courtIndex === match.courtIndex &&
        resource.startTime === match.startTime,
    );
    const cells = stampCellCount(match, cellMinutes);
    if (start) {
      const block = consecutiveResources(resources, start, cells);
      if (block) {
        occupyBlock(occupied, block);
        continue;
      }
    }
    occupied.add(
      resourceKey(match.playDate, match.courtIndex, match.startTime),
    );
  }
}

function pickSlotBlock(params: {
  resources: ResourceSlot[];
  occupied: Set<string>;
  afterBound: SlotBound | null;
  requireRest: boolean;
  cellsNeeded: number;
}): { start: ResourceSlot; block: ResourceSlot[] } | null {
  const restAfter =
    params.requireRest && params.afterBound
      ? restBound(params.afterBound)
      : params.afterBound;

  for (const slot of params.resources) {
    if (restAfter && !isSlotAfterBound(slot, restAfter)) continue;
    const block = consecutiveResources(
      params.resources,
      slot,
      params.cellsNeeded,
    );
    if (!block) continue;
    if (block.some((resource) => occupiedHas(params.occupied, resource))) {
      continue;
    }
    return { start: slot, block };
  }
  return null;
}

function occupiedHas(occupied: Set<string>, slot: ResourceSlot) {
  return occupied.has(resourceKey(slot.playDate, slot.courtIndex, slot.startTime));
}

function pickLastFreeBlock(
  resources: ResourceSlot[],
  occupied: Set<string>,
  cellsNeeded: number,
): { start: ResourceSlot; block: ResourceSlot[] } | null {
  for (let index = resources.length - 1; index >= 0; index--) {
    const slot = resources[index];
    if (!slot) continue;
    const block = consecutiveResources(resources, slot, cellsNeeded);
    if (!block) continue;
    if (block.some((resource) => occupiedHas(occupied, resource))) continue;
    return { start: slot, block };
  }
  return null;
}

function durationForRound(
  input: { slotMinutes: number; roundSlotMinutes?: (categoryId: string, roundLabel: string) => number },
  categoryId: string,
  roundLabel: string,
) {
  return input.roundSlotMinutes?.(categoryId, roundLabel) ?? input.slotMinutes;
}

export function buildIntermediateFixture(
  input: BuildIntermediateFixtureInput,
): IntermediateFixtureResult {
  const builtAt = new Date().toISOString();
  const warnings: string[] = [];
  const { day, resources } = buildPenultimateSlots(input);

  if (!day) {
    return {
      categories: input.categories
        .filter((category) =>
          categoryHasIntermediatePhase({
            pairCount: category.pairCount,
            zone4Advancers: category.zone4Advancers,
            startsAtRound: category.startsAtRound,
          }),
        )
        .map((category) => ({
          categoryId: category.categoryId,
          rounds: [],
          warnings: [
            "El torneo no tiene penúltimo día (hace falta al menos 2 días de juego).",
          ],
          builtAt,
        })),
      warnings: [
        "El torneo no tiene penúltimo día (hace falta al menos 2 días de juego).",
      ],
      builtAt,
    };
  }

  if (resources.length === 0) {
    warnings.push("No hay franjas horarias en el penúltimo día.");
  }

  const occupied = new Set<string>();
  const allZoneMatches = input.categories.flatMap(
    (category) => category.zonesFixtureMatches,
  );
  occupyZoneSlots(occupied, resources, allZoneMatches, input.slotMinutes);
  occupyZoneSlots(occupied, resources, input.reservedMatches ?? [], input.slotMinutes);
  const zonesBound = latestZoneBound(
    [...allZoneMatches, ...(input.reservedMatches ?? [])],
    input.slotMinutes,
  );

  const queues = input.categories
    .map((category) => {
      const rounds = buildIntermediateOfficialRounds(
        category.pairCount,
        category.zone4Advancers,
        category.startsAtRound,
      );
      const matches: PendingMatch[] = rounds.flatMap((round) =>
        round.crossings.map((crossing) => ({
          categoryId: category.categoryId,
          officialId: crossing.id,
          roundLabel: round.label,
          left: crossing.left,
          right: crossing.right,
        })),
      );
      return { category, matches };
    })
    .filter((queue) => queue.matches.length > 0);

  const scheduledByCategory = new Map<string, IntermediateScheduledMatch[]>();
  const scheduledByOfficial = new Map<string, IntermediateScheduledMatch>();
  const noRestIds = new Set<string>();

  const maxLen = queues.reduce(
    (max, queue) => Math.max(max, queue.matches.length),
    0,
  );

  for (let index = 0; index < maxLen; index++) {
    for (const queue of queues) {
      const pending = queue.matches[index];
      if (!pending) continue;

      const feeders = feederOfficialIds(pending.left, pending.right)
        .map((id) =>
          scheduledByOfficial.get(`${pending.categoryId}:${id}`),
        )
        .filter((match): match is IntermediateScheduledMatch => Boolean(match));

      const missingFeeder = feederOfficialIds(pending.left, pending.right).some(
        (id) => {
          const feeder = scheduledByOfficial.get(`${pending.categoryId}:${id}`);
          return !feeder || !feeder.playDate || feeder.slotIndex == null;
        },
      );

      let afterBound = zonesBound;
      for (const feeder of feeders) {
        if (feeder.playDate) {
          const slotIndex = matchLastSlotIndex(feeder, input.slotMinutes);
          if (slotIndex != null) {
            afterBound = laterBound(afterBound, {
              playDate: feeder.playDate,
              slotIndex,
            });
          }
        }
      }

      const duration = durationForRound(
        input,
        pending.categoryId,
        pending.roundLabel,
      );
      const cellsNeeded = cellsNeededFor(duration, input.slotMinutes);
      let picked: { start: ResourceSlot; block: ResourceSlot[] } | null = null;
      let usedRestFallback = false;
      if (!missingFeeder || feeders.length === 0) {
        picked = pickSlotBlock({
          resources,
          occupied,
          afterBound,
          requireRest: Boolean(afterBound),
          cellsNeeded,
        });
        if (!picked && afterBound) {
          picked = pickSlotBlock({
            resources,
            occupied,
            afterBound,
            requireRest: false,
            cellsNeeded,
          });
          usedRestFallback = Boolean(picked);
        }
      }

      const slot = picked?.start ?? null;
      const last = picked?.block[picked.block.length - 1] ?? null;
      const list = scheduledByCategory.get(pending.categoryId) ?? [];
      const scheduled: IntermediateScheduledMatch = {
        officialId: pending.officialId,
        roundLabel: pending.roundLabel,
        matchIndex: list.length,
        left: pending.left,
        right: pending.right,
        playDate: slot?.playDate ?? null,
        startTime: slot?.startTime ?? null,
        endTime: last?.endTime ?? slot?.endTime ?? null,
        courtIndex: slot?.courtIndex ?? null,
        slotIndex: slot?.slotIndex ?? null,
        noRestGap: usedRestFallback,
      };

      if (!picked) {
        warnings.push(
          missingFeeder && feeders.length > 0
            ? `${pending.roundLabel} n° ${pending.officialId}: sin horario posterior a sus feeders.`
            : `${pending.roundLabel} n° ${pending.officialId}: sin horario disponible.`,
        );
      } else {
        occupyBlock(occupied, picked.block);
        if (usedRestFallback) {
          noRestIds.add(`${pending.categoryId}:${pending.officialId}`);
        }
      }

      list.push(scheduled);
      scheduledByCategory.set(pending.categoryId, list);
      scheduledByOfficial.set(
        `${pending.categoryId}:${pending.officialId}`,
        scheduled,
      );
    }
  }

  if (noRestIds.size > 0) {
    warnings.push(
      `${noRestIds.size} partido(s) sin celda de descanso entre turnos de una pareja.`,
    );
  }

  const categories: IntermediateFixtureCategoryResult[] = queues.map(
    (queue) => {
      const matches = scheduledByCategory.get(queue.category.categoryId) ?? [];
      const byRound = new Map<string, IntermediateScheduledMatch[]>();
      for (const match of matches) {
        const list = byRound.get(match.roundLabel) ?? [];
        list.push(match);
        byRound.set(match.roundLabel, list);
      }
      const rounds = buildIntermediateOfficialRounds(
        queue.category.pairCount,
        queue.category.zone4Advancers,
        queue.category.startsAtRound,
      ).map((round) => ({
        label: round.label,
        matches: (byRound.get(round.label) ?? []).map((match, index) => ({
          ...match,
          matchIndex: index,
        })),
      }));
      const ownWarnings = warnings.filter((warning) =>
        rounds.some((round) =>
          round.matches.some((match) =>
            warning.includes(`n° ${match.officialId}`),
          ),
        ),
      );
      return {
        categoryId: queue.category.categoryId,
        rounds,
        warnings: ownWarnings.length > 0 ? ownWarnings : warnings.slice(0, 1),
        builtAt,
      };
    },
  );

  return { categories, warnings, builtAt };
}

export function buildFinalFixture(
  input: BuildFinalFixtureInput,
): IntermediateFixtureResult {
  const builtAt = new Date().toISOString();
  const warnings: string[] = [];
  const { day, resources } = buildLastDaySlots(input);

  if (!day) {
    return {
      categories: input.categories
        .filter((category) =>
          categoryHasFinalPhase({
            pairCount: category.pairCount,
            zone4Advancers: category.zone4Advancers,
            startsAtRound: category.startsAtRound,
          }),
        )
        .map((category) => ({
          categoryId: category.categoryId,
          rounds: [],
          warnings: ["El torneo no tiene un último día de juego."],
          builtAt,
        })),
      warnings: ["El torneo no tiene un último día de juego."],
      builtAt,
    };
  }

  if (resources.length === 0) {
    warnings.push("No hay franjas horarias en el último día.");
  }

  const occupied = new Set<string>();
  const priorStamps = input.categories.flatMap((category) => [
    ...category.zonesFixtureMatches,
    ...(category.priorKnockoutMatches ?? []),
  ]);
  occupyZoneSlots(occupied, resources, priorStamps, input.slotMinutes);
  occupyZoneSlots(
    occupied,
    resources,
    input.reservedMatches ?? [],
    input.slotMinutes,
  );
  const zonesBound = latestZoneBound(
    [...priorStamps, ...(input.reservedMatches ?? [])],
    input.slotMinutes,
  );

  const queues = input.categories
    .map((category) => {
      const rounds = buildFinalOfficialRounds(
        category.pairCount,
        category.zone4Advancers,
        category.startsAtRound,
      );
      const matches: PendingMatch[] = rounds.flatMap((round) =>
        round.crossings.map((crossing) => ({
          categoryId: category.categoryId,
          officialId: crossing.id,
          roundLabel: round.label,
          left: crossing.left,
          right: crossing.right,
        })),
      );
      return { category, matches };
    })
    .filter((queue) => queue.matches.length > 0);

  const scheduledByCategory = new Map<string, IntermediateScheduledMatch[]>();
  const scheduledByOfficial = new Map<string, IntermediateScheduledMatch>();
  const noRestIds = new Set<string>();

  for (const category of input.categories) {
    for (const prior of category.priorKnockoutMatches ?? []) {
      scheduledByOfficial.set(
        `${category.categoryId}:${prior.officialId}`,
        prior,
      );
    }
  }

  const maxLen = queues.reduce(
    (max, queue) => Math.max(max, queue.matches.length),
    0,
  );

  for (let index = 0; index < maxLen; index++) {
    for (const queue of queues) {
      const pending = queue.matches[index];
      if (!pending) continue;

      const feeders = feederOfficialIds(pending.left, pending.right)
        .map((id) =>
          scheduledByOfficial.get(`${pending.categoryId}:${id}`),
        )
        .filter((match): match is IntermediateScheduledMatch => Boolean(match));

      const missingFeeder = feederOfficialIds(pending.left, pending.right).some(
        (id) => {
          const feeder = scheduledByOfficial.get(`${pending.categoryId}:${id}`);
          return !feeder || !feeder.playDate || feeder.slotIndex == null;
        },
      );

      let afterBound = zonesBound;
      for (const feeder of feeders) {
        if (feeder.playDate) {
          const slotIndex = matchLastSlotIndex(feeder, input.slotMinutes);
          if (slotIndex != null) {
            afterBound = laterBound(afterBound, {
              playDate: feeder.playDate,
              slotIndex,
            });
          }
        }
      }

      const duration = durationForRound(
        input,
        pending.categoryId,
        pending.roundLabel,
      );
      const cellsNeeded = cellsNeededFor(duration, input.slotMinutes);
      let picked: { start: ResourceSlot; block: ResourceSlot[] } | null = null;
      let usedRestFallback = false;
      if (!missingFeeder || feeders.length === 0) {
        picked = pickSlotBlock({
          resources,
          occupied,
          afterBound,
          requireRest: Boolean(afterBound),
          cellsNeeded,
        });
        if (!picked && afterBound) {
          picked = pickSlotBlock({
            resources,
            occupied,
            afterBound,
            requireRest: false,
            cellsNeeded,
          });
          usedRestFallback = Boolean(picked);
        }
      }
      if (!picked) {
        picked = pickLastFreeBlock(resources, occupied, cellsNeeded);
        usedRestFallback = Boolean(picked);
      }

      const slot = picked?.start ?? null;
      const last = picked?.block[picked.block.length - 1] ?? null;
      const list = scheduledByCategory.get(pending.categoryId) ?? [];
      const scheduled: IntermediateScheduledMatch = {
        officialId: pending.officialId,
        roundLabel: pending.roundLabel,
        matchIndex: list.length,
        left: pending.left,
        right: pending.right,
        playDate: slot?.playDate ?? null,
        startTime: slot?.startTime ?? null,
        endTime: last?.endTime ?? slot?.endTime ?? null,
        courtIndex: slot?.courtIndex ?? null,
        slotIndex: slot?.slotIndex ?? null,
        noRestGap: usedRestFallback,
      };

      if (!picked) {
        warnings.push(
          missingFeeder && feeders.length > 0
            ? `${pending.roundLabel} n° ${pending.officialId}: sin horario posterior a sus feeders.`
            : `${pending.roundLabel} n° ${pending.officialId}: sin horario disponible.`,
        );
      } else {
        occupyBlock(occupied, picked.block);
        if (usedRestFallback) {
          noRestIds.add(`${pending.categoryId}:${pending.officialId}`);
        }
      }

      list.push(scheduled);
      scheduledByCategory.set(pending.categoryId, list);
      scheduledByOfficial.set(
        `${pending.categoryId}:${pending.officialId}`,
        scheduled,
      );
    }
  }

  if (noRestIds.size > 0) {
    warnings.push(
      `${noRestIds.size} partido(s) sin celda de descanso entre turnos de una pareja.`,
    );
  }

  const categories: IntermediateFixtureCategoryResult[] = queues.map(
    (queue) => {
      const matches = scheduledByCategory.get(queue.category.categoryId) ?? [];
      const byRound = new Map<string, IntermediateScheduledMatch[]>();
      for (const match of matches) {
        const list = byRound.get(match.roundLabel) ?? [];
        list.push(match);
        byRound.set(match.roundLabel, list);
      }
      const rounds = buildFinalOfficialRounds(
        queue.category.pairCount,
        queue.category.zone4Advancers,
        queue.category.startsAtRound,
      ).map((round) => ({
        label: round.label,
        matches: (byRound.get(round.label) ?? []).map((match, index) => ({
          ...match,
          matchIndex: index,
        })),
      }));
      const ownWarnings = warnings.filter((warning) =>
        rounds.some((round) =>
          round.matches.some((match) =>
            warning.includes(`n° ${match.officialId}`),
          ),
        ),
      );
      return {
        categoryId: queue.category.categoryId,
        rounds,
        warnings: ownWarnings.length > 0 ? ownWarnings : warnings.slice(0, 1),
        builtAt,
      };
    },
  );

  return { categories, warnings, builtAt };
}
