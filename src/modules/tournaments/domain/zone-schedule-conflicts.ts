import type { PlayDayValues } from "./config-schema";
import {
  knockoutFixtureStamps,
  type IntermediateFixturePersisted,
} from "./intermediate-fixture-schema";
import {
  buildPlayDayRulerSlots,
  effectiveOvernightExtraSlots,
  resolveEnabledSlotIndexes,
} from "./play-day-slots";
import type { ZonesFixturePersisted } from "./zones-fixture-schema";

export type ZoneScheduleMatch = {
  id: string;
  playDate: string;
  startTime: string;
  courtIndex: number | null;
  pair1Id: string | null;
  pair2Id: string | null;
  kind?: string;
};

export type ZoneScheduleDraft = {
  id: string;
  label: string;
  pairIds: string[];
  matches: ZoneScheduleMatch[];
};

export type SlotOccupantHint = {
  zoneLabel: string;
  matchId: string;
  reason: "court" | "pair";
};

/** Cancha/hora ya tomada por otra categoría (o por intermedia/final). */
export type ExternalCourtSlot = {
  playDate: string;
  startTime: string;
  courtIndex: number;
  label: string;
};

function scheduled(match: ZoneScheduleMatch): boolean {
  return Boolean(match.playDate.trim() && match.startTime.trim());
}

function pairIdsForMatch(
  zone: Pick<ZoneScheduleDraft, "pairIds">,
  match: ZoneScheduleMatch,
): string[] {
  if (match.kind === "winners" || match.kind === "losers") {
    return zone.pairIds;
  }
  return [match.pair1Id, match.pair2Id].filter((id): id is string => Boolean(id));
}

function courtKey(match: ZoneScheduleMatch): string | null {
  if (!scheduled(match) || match.courtIndex == null) return null;
  return `${match.playDate}|${match.startTime}|${match.courtIndex}`;
}

function pairSlotKey(pairId: string, match: ZoneScheduleMatch): string | null {
  if (!scheduled(match)) return null;
  return `${pairId}|${match.playDate}|${match.startTime}`;
}

export function scheduleConflictMatchIds(
  zones: ZoneScheduleDraft[],
  externalSlots: ExternalCourtSlot[] = [],
): {
  court: Set<string>;
  pair: Set<string>;
  externalCourt: Set<string>;
  all: Set<string>;
} {
  const courtBuckets = new Map<string, string[]>();
  const pairBuckets = new Map<string, string[]>();
  const externalKeys = new Set(
    externalSlots.map((slot) =>
      courtKey({
        id: slot.label,
        playDate: slot.playDate,
        startTime: slot.startTime,
        courtIndex: slot.courtIndex,
        pair1Id: null,
        pair2Id: null,
      }),
    ),
  );

  const externalCourt = new Set<string>();
  for (const zone of zones) {
    for (const match of zone.matches) {
      const court = courtKey(match);
      if (court) {
        const list = courtBuckets.get(court) ?? [];
        list.push(match.id);
        courtBuckets.set(court, list);
        if (externalKeys.has(court)) externalCourt.add(match.id);
      }
      for (const pairId of pairIdsForMatch(zone, match)) {
        const key = pairSlotKey(pairId, match);
        if (!key) continue;
        const list = pairBuckets.get(key) ?? [];
        list.push(match.id);
        pairBuckets.set(key, list);
      }
    }
  }

  const court = new Set<string>(externalCourt);
  for (const ids of courtBuckets.values()) {
    if (new Set(ids).size > 1) {
      for (const id of ids) court.add(id);
    }
  }

  const pair = new Set<string>();
  for (const ids of pairBuckets.values()) {
    if (new Set(ids).size > 1) {
      for (const id of ids) pair.add(id);
    }
  }

  return { court, pair, externalCourt, all: new Set([...court, ...pair]) };
}

/** Zonas que tienen un choque, omitiendo el partido que se acaba de editar. */
export function scheduleConflictZoneIds(
  zones: ZoneScheduleDraft[],
  conflictMatchIds: Set<string>,
  excludeMatchId?: string | null,
  forceMatchIds?: Set<string> | null,
): Set<string> {
  const ids = new Set<string>();
  for (const zone of zones) {
    const hasForced = zone.matches.some((match) =>
      forceMatchIds?.has(match.id),
    );
    const hasOther = zone.matches.some(
      (match) =>
        conflictMatchIds.has(match.id) && match.id !== excludeMatchId,
    );
    if (hasForced || hasOther) ids.add(zone.id);
  }
  return ids;
}

export function slotOccupants(
  zones: ZoneScheduleDraft[],
  playDate: string,
  startTime: string,
  courtIndex: number | null,
  excludeMatchId?: string | null,
  busyPairIds?: string[],
  externalSlots: ExternalCourtSlot[] = [],
): SlotOccupantHint[] {
  if (!playDate || !startTime) return [];
  const watching = new Set(busyPairIds ?? []);
  const hints: SlotOccupantHint[] = [];
  for (const zone of zones) {
    for (const match of zone.matches) {
      if (match.id === excludeMatchId || !scheduled(match)) continue;
      if (match.playDate !== playDate || match.startTime !== startTime) {
        continue;
      }
      if (courtIndex != null && match.courtIndex === courtIndex) {
        hints.push({
          zoneLabel: zone.label,
          matchId: match.id,
          reason: "court",
        });
      }
      if (
        watching.size > 0 &&
        pairIdsForMatch(zone, match).some((id) => watching.has(id))
      ) {
        hints.push({
          zoneLabel: zone.label,
          matchId: match.id,
          reason: "pair",
        });
      }
    }
  }
  if (courtIndex != null) {
    for (const slot of externalSlots) {
      if (
        slot.playDate === playDate &&
        slot.startTime === startTime &&
        slot.courtIndex === courtIndex
      ) {
        hints.push({
          zoneLabel: slot.label,
          matchId: slot.label,
          reason: "court",
        });
      }
    }
  }
  return hints;
}

function pushExternalSlot(
  slots: ExternalCourtSlot[],
  playDate: string | null | undefined,
  startTime: string | null | undefined,
  courtIndex: number | null | undefined,
  label: string,
) {
  const date = playDate?.trim() ?? "";
  const time = startTime?.trim() ?? "";
  if (!date || !time || courtIndex == null) return;
  slots.push({ playDate: date, startTime: time, courtIndex, label });
}

export function collectExternalCourtSlots(input: {
  categories: Array<{
    categoryId: string;
    categoryName: string;
    zonesFixture: ZonesFixturePersisted | null;
    intermediateFixture: IntermediateFixturePersisted | null;
    finalFixture: IntermediateFixturePersisted | null;
  }>;
  activeCategoryId: string;
  localZonesByCategory?: Record<
    string,
    { label: string; matches: ZoneScheduleMatch[] }[]
  >;
}): ExternalCourtSlot[] {
  const slots: ExternalCourtSlot[] = [];
  for (const category of input.categories) {
    const name = category.categoryName.trim() || "Otra categoría";
    const isActive = category.categoryId === input.activeCategoryId;

    if (!isActive) {
      const draft = input.localZonesByCategory?.[category.categoryId];
      if (draft && draft.length > 0) {
        for (const zone of draft) {
          for (const match of zone.matches) {
            pushExternalSlot(
              slots,
              match.playDate,
              match.startTime,
              match.courtIndex,
              `${name} · ${zone.label}`,
            );
          }
        }
      } else {
        for (const zone of category.zonesFixture?.zones ?? []) {
          for (const match of zone.matches) {
            pushExternalSlot(
              slots,
              match.playDate,
              match.startTime,
              match.courtIndex,
              `${name} · ${zone.label}`,
            );
          }
        }
      }
    }

    for (const stamp of knockoutFixtureStamps(category.intermediateFixture)) {
      pushExternalSlot(
        slots,
        stamp.playDate,
        stamp.startTime,
        stamp.courtIndex,
        `${name} · Intermedia`,
      );
    }
    for (const stamp of knockoutFixtureStamps(category.finalFixture)) {
      pushExternalSlot(
        slots,
        stamp.playDate,
        stamp.startTime,
        stamp.courtIndex,
        `${name} · Final`,
      );
    }
  }
  return slots;
}

export function labelsForCourtSlot(
  slots: ExternalCourtSlot[],
  playDate: string,
  startTime: string,
  courtIndex: number | null,
): string[] {
  if (!playDate || !startTime || courtIndex == null) return [];
  return [
    ...new Set(
      slots
        .filter(
          (slot) =>
            slot.playDate === playDate &&
            slot.startTime === startTime &&
            slot.courtIndex === courtIndex,
        )
        .map((slot) => slot.label),
    ),
  ];
}

export function startTimesForPlayDay(
  day: PlayDayValues,
  slotMinutes: number,
): string[] {
  const extras = effectiveOvernightExtraSlots(day, slotMinutes);
  const ruler = buildPlayDayRulerSlots(day.startTime, extras, slotMinutes);
  const enabled = resolveEnabledSlotIndexes(day, ruler);
  const times: string[] = [];
  for (const index of enabled) {
    const time = ruler[index]?.startTime;
    if (time && !times.includes(time)) times.push(time);
  }
  return times;
}
