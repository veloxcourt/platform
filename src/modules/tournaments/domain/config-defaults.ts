import { addDaysISO } from "@/lib/date";
import type {
  FinalPhaseConfigValues,
  PhaseConfigValues,
  PlayDayValues,
} from "./config-schema";
import { toPlayDayValues } from "./play-day-slots";

const DEFAULT_PLAY_WINDOW = {
  startTime: "09:00",
  endTime: "22:00",
  overnightExtraSlots: 0,
  enabledSlotIndexes: [] as number[],
  hasSlotSelection: false,
};

export function defaultPlayDays(
  startDate: string,
  endDate: string | null,
): PlayDayValues[] {
  const end = endDate && endDate >= startDate ? endDate : startDate;
  const days: PlayDayValues[] = [];
  let current = startDate;
  while (current <= end) {
    days.push(
      toPlayDayValues({
        date: current,
        ...DEFAULT_PLAY_WINDOW,
      }),
    );
    if (current === end) break;
    current = addDaysISO(current, 1);
  }
  return days;
}

/** Un día por fecha del torneo (Info). Conserva horarios ya cargados. */
export function syncPlayDaysToRange(
  existing: PlayDayValues[],
  startDate: string,
  endDate: string | null,
): PlayDayValues[] {
  const byDate = new Map(
    existing
      .filter((day) => day.date)
      .map((day) => [day.date, toPlayDayValues(day)]),
  );
  const template =
    existing.find((day) => day.startTime && day.endTime) ?? DEFAULT_PLAY_WINDOW;

  return defaultPlayDays(startDate, endDate).map((day) => {
    const previous = byDate.get(day.date);
    return previous
      ? { ...previous, date: day.date }
      : toPlayDayValues({
          date: day.date,
          startTime: template.startTime,
          endTime: template.endTime,
          overnightExtraSlots: template.overnightExtraSlots,
          enabledSlotIndexes: template.enabledSlotIndexes,
          hasSlotSelection: template.hasSlotSelection,
        });
  });
}

/// Valores por defecto por fase (zonas corto, intermedia media, final largo).
export function defaultPhaseConfigs(): {
  zones: PhaseConfigValues;
  knockout: PhaseConfigValues;
  final: FinalPhaseConfigValues;
} {
  return {
    zones: { matchFormat: "ONE_SET_6", matchDurationMin: 75, playDates: [] },
    knockout: {
      matchFormat: "TWO_SETS_STB",
      matchDurationMin: 90,
      playDates: [],
    },
    final: {
      matchFormat: "BEST_OF_3",
      matchDurationMin: 120,
      startsAtRound: "SEMI_FINALS",
      playDates: [],
    },
  };
}
