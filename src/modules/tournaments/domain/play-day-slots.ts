import {
  closingMinutes,
  minutesToTime,
  timeToMinutes,
} from "@/modules/bookings/domain/rules";
import type { PlayDayValues } from "./config-schema";
import { isValidPlayDayWindow, playDayWindowMinutes } from "./play-day";

export const PLAY_DAY_MIDNIGHT_MINUTES = 24 * 60;
export const MAX_OVERNIGHT_EXTRA_SLOTS = 12;
/** Negativo = recortar slots antes de las 0 hs; positivo = slots después de medianoche. */
export const MIN_OVERNIGHT_EXTRA_SLOTS = -12;

export type PlayDayRulerSlot = {
  slotIndex: number;
  startTime: string;
  endTime: string;
  startAbs: number;
  endAbs: number;
};

function clockTime(absoluteMin: number): string {
  return minutesToTime(
    ((absoluteMin % PLAY_DAY_MIDNIGHT_MINUTES) + PLAY_DAY_MIDNIGHT_MINUTES) %
      PLAY_DAY_MIDNIGHT_MINUTES,
  );
}

/// Duración de cada celda: partido de zonas + intervalo (igual que inscripciones).
export function zonesPlaySlotMinutes(
  matchDurationMin?: number | null,
  intervalMin?: number | null,
): number {
  const duration =
    Number.isFinite(matchDurationMin) && (matchDurationMin ?? 0) > 0
      ? Number(matchDurationMin)
      : 75;
  const interval =
    Number.isFinite(intervalMin) && (intervalMin ?? 0) >= 0
      ? Number(intervalMin)
      : 0;
  return Math.max(1, duration + interval);
}

export function playDayPersistFields(day: PlayDayValues): {
  startTime: string;
  endTime: string;
  overnightExtraSlots: number;
  enabledSlotIndexes: number[];
  hasSlotSelection: boolean;
} {
  return {
    startTime: day.startTime,
    endTime: day.endTime,
    overnightExtraSlots: day.overnightExtraSlots ?? 0,
    enabledSlotIndexes: day.enabledSlotIndexes ?? [],
    hasSlotSelection: day.hasSlotSelection ?? false,
  };
}

export function toPlayDayValues(day: {
  date: string;
  startTime: string;
  endTime: string;
  overnightExtraSlots?: number | null;
  enabledSlotIndexes?: number[] | null;
  hasSlotSelection?: boolean | null;
}): PlayDayValues {
  return {
    date: day.date,
    startTime: day.startTime,
    endTime: day.endTime,
    overnightExtraSlots: day.overnightExtraSlots ?? 0,
    enabledSlotIndexes: [...(day.enabledSlotIndexes ?? [])],
    hasSlotSelection: day.hasSlotSelection ?? false,
  };
}

function clampOvernightExtraSlots(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(
    MIN_OVERNIGHT_EXTRA_SLOTS,
    Math.min(MAX_OVERNIGHT_EXTRA_SLOTS, Math.trunc(value)),
  );
}

/// Desplaza el horario de arranque un slot hacia atrás (izquierda) o adelante.
export function shiftPlayDayStartTime(
  startTime: string,
  slotMinutes: number,
  direction: -1 | 1,
): string {
  const step = Math.max(1, slotMinutes);
  const next =
    (((timeToMinutes(startTime) + direction * step) % PLAY_DAY_MIDNIGHT_MINUTES) +
      PLAY_DAY_MIDNIGHT_MINUTES) %
    PLAY_DAY_MIDNIGHT_MINUTES;
  return minutesToTime(next);
}

/// Regla desde el horario de arranque hasta las 0 hs (o recortada), más extras de madrugada.
export function buildPlayDayRulerSlots(
  startTime: string,
  overnightExtraSlots: number,
  slotMinutes: number,
): PlayDayRulerSlot[] {
  if (!startTime || slotMinutes <= 0) return [];
  const start = timeToMinutes(startTime);
  const extras = clampOvernightExtraSlots(overnightExtraSlots);
  const slots: PlayDayRulerSlot[] = [];
  let t = start;
  let index = 0;

  while (t <= PLAY_DAY_MIDNIGHT_MINUTES) {
    slots.push({
      slotIndex: index,
      startAbs: t,
      endAbs: t + slotMinutes,
      startTime: clockTime(t),
      endTime: clockTime(t + slotMinutes),
    });
    index += 1;
    t += slotMinutes;
  }

  if (extras > 0) {
    for (let i = 0; i < extras; i += 1) {
      slots.push({
        slotIndex: index,
        startAbs: t,
        endAbs: t + slotMinutes,
        startTime: clockTime(t),
        endTime: clockTime(t + slotMinutes),
      });
      index += 1;
      t += slotMinutes;
    }
  } else if (extras < 0) {
    const keep = Math.max(1, slots.length + extras);
    slots.length = keep;
    for (let i = 0; i < slots.length; i += 1) {
      slots[i] = { ...slots[i], slotIndex: i };
    }
  }

  return slots;
}

function windowSlotCount(
  startTime: string,
  endTime: string,
  slotMinutes: number,
): number {
  if (!isValidPlayDayWindow(startTime, endTime) || slotMinutes <= 0) return 0;
  const start = timeToMinutes(startTime);
  const end = closingMinutes(startTime, endTime);
  return Math.max(0, Math.floor((end - start) / slotMinutes));
}

/// Cuántos slots después de las 0 hs hacen falta para cubrir el Hasta actual.
export function overnightExtraSlotsToCoverEnd(
  startTime: string,
  endTime: string,
  slotMinutes: number,
): number {
  const windowCount = windowSlotCount(startTime, endTime, slotMinutes);
  const baseCount = buildPlayDayRulerSlots(startTime, 0, slotMinutes).length;
  return Math.max(0, windowCount - baseCount);
}

export function effectiveOvernightExtraSlots(
  day: Pick<
    PlayDayValues,
    "startTime" | "endTime" | "overnightExtraSlots" | "hasSlotSelection"
  >,
  slotMinutes: number,
): number {
  const stored = clampOvernightExtraSlots(day.overnightExtraSlots ?? 0);
  if (day.hasSlotSelection) {
    return stored;
  }
  return clampOvernightExtraSlots(
    Math.max(
      stored,
      overnightExtraSlotsToCoverEnd(day.startTime, day.endTime, slotMinutes),
    ),
  );
}

export function slotIndexesWithinWindow(
  ruler: PlayDayRulerSlot[],
  startTime: string,
  endTime: string,
): number[] {
  if (!isValidPlayDayWindow(startTime, endTime)) return [];
  const start = timeToMinutes(startTime);
  const end = closingMinutes(startTime, endTime);
  return ruler
    .filter((slot) => slot.startAbs >= start && slot.endAbs <= end)
    .map((slot) => slot.slotIndex);
}

export function resolveEnabledSlotIndexes(
  day: PlayDayValues,
  ruler: PlayDayRulerSlot[],
): number[] {
  if (day.hasSlotSelection) {
    const max = ruler.length;
    return [...new Set(day.enabledSlotIndexes ?? [])]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < max)
      .sort((a, b) => a - b);
  }
  return slotIndexesWithinWindow(ruler, day.startTime, day.endTime);
}

export function derivePlayDayEndTime(
  startTime: string,
  ruler: PlayDayRulerSlot[],
  enabled: number[],
): string {
  if (ruler.length === 0) return startTime;
  const lastIndex =
    enabled.length > 0 ? Math.max(...enabled) : ruler.length - 1;
  return ruler[lastIndex]?.endTime ?? startTime;
}

export function remapEnabledSlotIndexes(
  previous: PlayDayRulerSlot[],
  previousEnabled: number[],
  next: PlayDayRulerSlot[],
): number[] {
  const times = new Set(
    previousEnabled
      .map((index) => previous[index]?.startTime)
      .filter((time): time is string => Boolean(time)),
  );
  return next
    .filter((slot) => times.has(slot.startTime))
    .map((slot) => slot.slotIndex);
}

export function materializePlayDaySelection(
  day: PlayDayValues,
  slotMinutes: number,
): PlayDayValues {
  const overnightExtraSlots = effectiveOvernightExtraSlots(day, slotMinutes);
  const ruler = buildPlayDayRulerSlots(
    day.startTime,
    overnightExtraSlots,
    slotMinutes,
  );
  const enabledSlotIndexes = resolveEnabledSlotIndexes(
    { ...day, overnightExtraSlots },
    ruler,
  );
  return {
    ...day,
    overnightExtraSlots,
    enabledSlotIndexes,
    hasSlotSelection: true,
    endTime: derivePlayDayEndTime(day.startTime, ruler, enabledSlotIndexes),
  };
}

export type PlayDayWindowEdge = "start" | "end";
export type PlayDayWindowDelta = "add" | "remove";
export const PLAY_DAY_START_MINUTES = [0, 15, 30, 45] as const;
export type PlayDayStartMinutes = (typeof PLAY_DAY_START_MINUTES)[number];

function playDayRulerSnapshot(
  day: PlayDayValues,
  slotMinutes: number,
): {
  day: PlayDayValues;
  overnight: number;
  ruler: PlayDayRulerSlot[];
} {
  const materialized = materializePlayDaySelection(day, slotMinutes);
  const overnight = clampOvernightExtraSlots(
    materialized.overnightExtraSlots ?? 0,
  );
  return {
    day: materialized,
    overnight,
    ruler: buildPlayDayRulerSlots(
      materialized.startTime,
      overnight,
      slotMinutes,
    ),
  };
}

export function canAdjustPlayDayWindow(
  day: PlayDayValues | undefined,
  slotMinutes: number,
  edge: PlayDayWindowEdge,
  delta: PlayDayWindowDelta,
): boolean {
  if (!day?.startTime || slotMinutes <= 0) return false;
  const { overnight, ruler } = playDayRulerSnapshot(day, slotMinutes);
  if (delta === "remove" && ruler.length <= 1) return false;
  if (edge === "end" && delta === "add") {
    return overnight < MAX_OVERNIGHT_EXTRA_SLOTS;
  }
  if (edge === "end" && delta === "remove") {
    return overnight > MIN_OVERNIGHT_EXTRA_SLOTS;
  }
  return true;
}

/// Suma o quita un slot al inicio o al final del día (misma regla que Parámetros).
export function adjustPlayDayWindow(
  day: PlayDayValues,
  slotMinutes: number,
  edge: PlayDayWindowEdge,
  delta: PlayDayWindowDelta,
): PlayDayValues | null {
  if (!canAdjustPlayDayWindow(day, slotMinutes, edge, delta)) return null;

  const { day: current, overnight, ruler } = playDayRulerSnapshot(
    day,
    slotMinutes,
  );
  const enabled = current.enabledSlotIndexes;

  if (edge === "start") {
    const nextStart = shiftPlayDayStartTime(
      current.startTime,
      slotMinutes,
      delta === "add" ? -1 : 1,
    );
    const nextRuler = buildPlayDayRulerSlots(
      nextStart,
      overnight,
      slotMinutes,
    );
    const remapped = remapEnabledSlotIndexes(ruler, enabled, nextRuler);
    const nextEnabled =
      delta === "add"
        ? [...new Set([0, ...remapped])].sort((a, b) => a - b)
        : remapped;
    return {
      ...current,
      startTime: nextStart,
      overnightExtraSlots: overnight,
      enabledSlotIndexes: nextEnabled,
      hasSlotSelection: true,
      endTime: derivePlayDayEndTime(nextStart, nextRuler, nextEnabled),
    };
  }

  const nextOvernight = overnight + (delta === "add" ? 1 : -1);
  const nextRuler = buildPlayDayRulerSlots(
    current.startTime,
    nextOvernight,
    slotMinutes,
  );
  if (nextRuler.length === 0) return null;
  const extraIndex = nextRuler.length - 1;
  const nextEnabled =
    delta === "add"
      ? extraIndex >= 0
        ? [...new Set([...enabled, extraIndex])].sort((a, b) => a - b)
        : enabled
      : enabled.filter((value) => value < nextRuler.length);

  return {
    ...current,
    overnightExtraSlots: nextOvernight,
    enabledSlotIndexes: nextEnabled,
    hasSlotSelection: true,
    endTime: derivePlayDayEndTime(current.startTime, nextRuler, nextEnabled),
  };
}

function visibleWindowBounds(day: PlayDayValues, slotMinutes: number) {
  const step = Math.max(1, slotMinutes);
  const start = timeToMinutes(day.startTime);
  const end = closingMinutes(day.startTime, day.endTime);
  return {
    step,
    start,
    end,
    slots: Math.max(0, Math.floor((end - start) / step)),
  };
}

/// En la grilla de simulación el rango visible es start/end continuo.
/// El + / − debe mover ese rango un solo slot, no saltar al último extra
/// de madrugada (eso rellenaba 4–5 celdas de golpe).
export function canShiftPlayDayVisibleWindow(
  day: PlayDayValues | undefined,
  slotMinutes: number,
  edge: PlayDayWindowEdge,
  delta: PlayDayWindowDelta,
): boolean {
  if (!day?.startTime || !day.endTime || slotMinutes <= 0) return false;
  const { step, start, end, slots } = visibleWindowBounds(day, slotMinutes);
  if (slots <= 0) return false;
  if (delta === "remove") return slots > 1;
  if (edge === "end") {
    const nextEndTime = clockTime(end + step);
    return (
      overnightExtraSlotsToCoverEnd(day.startTime, nextEndTime, step) <=
      MAX_OVERNIGHT_EXTRA_SLOTS
    );
  }
  return true;
}

export function shiftPlayDayVisibleWindow(
  day: PlayDayValues,
  slotMinutes: number,
  edge: PlayDayWindowEdge,
  delta: PlayDayWindowDelta,
): PlayDayValues | null {
  if (!canShiftPlayDayVisibleWindow(day, slotMinutes, edge, delta)) return null;

  const { step, start, end } = visibleWindowBounds(day, slotMinutes);
  let nextStart = start;
  let nextEnd = end;
  if (edge === "start") {
    nextStart += delta === "add" ? -step : step;
  } else {
    nextEnd += delta === "add" ? step : -step;
  }
  if (nextEnd - nextStart < step) return null;

  return materializePlayDaySelection(
    {
      ...day,
      startTime: clockTime(nextStart),
      endTime: clockTime(nextEnd),
      overnightExtraSlots: 0,
      hasSlotSelection: false,
      enabledSlotIndexes: [],
    },
    step,
  );
}

/// Cambia solo los minutos de arranque (00 / 15 / 30 / 45) y corre el mismo
/// desfase en todo el rango, para que los slots siguientes queden alineados.
export function setPlayDayStartMinutes(
  day: PlayDayValues,
  slotMinutes: number,
  minutes: PlayDayStartMinutes,
): PlayDayValues | null {
  if (!day.startTime || !day.endTime || slotMinutes <= 0) return null;
  const { step, start, end } = visibleWindowBounds(day, slotMinutes);
  if (start % 60 === minutes) return null;
  const nextStart = Math.floor(start / 60) * 60 + minutes;
  const nextEnd = end + (nextStart - start);
  if (nextEnd - nextStart < step) return null;
  return materializePlayDaySelection(
    {
      ...day,
      startTime: clockTime(nextStart),
      endTime: clockTime(nextEnd),
      overnightExtraSlots: 0,
      hasSlotSelection: false,
      enabledSlotIndexes: [],
    },
    step,
  );
}

export function playDayRulerSelectedMinutes(
  day: PlayDayValues,
  slotMinutes: number,
): number {
  const step = Math.max(1, slotMinutes);
  const overnight = effectiveOvernightExtraSlots(day, step);
  const ruler = buildPlayDayRulerSlots(day.startTime, overnight, step);
  const enabled = resolveEnabledSlotIndexes(day, ruler);
  if (day.hasSlotSelection || ruler.length > 0) {
    return enabled.length * step;
  }
  return playDayWindowMinutes(day.startTime, day.endTime);
}
