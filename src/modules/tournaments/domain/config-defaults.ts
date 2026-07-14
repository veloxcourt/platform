import { addDaysISO } from "@/lib/date";
import type {
  FinalPhaseConfigValues,
  PhaseConfigValues,
  PlayDayValues,
} from "./config-schema";

export function defaultPlayDays(
  startDate: string,
  endDate: string | null,
): PlayDayValues[] {
  const end = endDate && endDate >= startDate ? endDate : startDate;
  const days: PlayDayValues[] = [];
  let current = startDate;
  while (current <= end) {
    days.push({ date: current, startTime: "09:00", endTime: "22:00" });
    if (current === end) break;
    current = addDaysISO(current, 1);
  }
  return days;
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
