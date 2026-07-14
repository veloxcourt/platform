import {
  closingMinutes,
  timeToMinutes,
} from "@/modules/bookings/domain/rules";

/// El rango pertenece a un único día de juego (la fecha de inicio), aunque el
/// horario de cierre caiga en la madrugada del día siguiente.
export function playDayEndsNextDay(
  startTime: string,
  endTime: string,
): boolean {
  return timeToMinutes(endTime) < timeToMinutes(startTime);
}

/// Minutos en la línea de tiempo del día de juego. Si el día abre de tarde y
/// sigue de madrugada, horas como 00:00 quedan después de 17:00/23:00.
export function playDayTimelineMinutes(
  startTime: string,
  dayOpenTime?: string | null,
): number {
  const t = timeToMinutes(startTime);
  if (!dayOpenTime) return t;
  const open = timeToMinutes(dayOpenTime);
  return t < open ? t + 24 * 60 : t;
}

type ScheduleStamp = {
  playDate?: string | null;
  startTime?: string | null;
};

/// Orden cronológico: día de juego, luego horario (soporta ventanas overnight).
export function comparePlayDaySchedule(
  a: ScheduleStamp,
  b: ScheduleStamp,
  dayOpenByDate?: Map<string, string> | Record<string, string>,
): number {
  const aDate = a.playDate?.trim() || "";
  const bDate = b.playDate?.trim() || "";
  if (!aDate && bDate) return 1;
  if (aDate && !bDate) return -1;
  if (aDate && bDate && aDate !== bDate) return aDate.localeCompare(bDate);

  const aTime = a.startTime?.trim() || "";
  const bTime = b.startTime?.trim() || "";
  if (!aTime && bTime) return 1;
  if (aTime && !bTime) return -1;
  if (!aTime && !bTime) return 0;

  const date = aDate || bDate;
  let dayOpen: string | undefined;
  if (dayOpenByDate && date) {
    dayOpen =
      dayOpenByDate instanceof Map
        ? dayOpenByDate.get(date)
        : dayOpenByDate[date];
  }

  return (
    playDayTimelineMinutes(aTime, dayOpen) -
    playDayTimelineMinutes(bTime, dayOpen)
  );
}

/// Duración habilitada en minutos para un día de juego.
export function playDayWindowMinutes(
  startTime: string,
  endTime: string,
): number {
  return closingMinutes(startTime, endTime) - timeToMinutes(startTime);
}

export function isValidPlayDayWindow(
  startTime: string,
  endTime: string,
): boolean {
  return playDayWindowMinutes(startTime, endTime) > 0;
}

export function playDayEndHint(
  startTime: string,
  endTime: string,
): string | null {
  if (!isValidPlayDayWindow(startTime, endTime)) return null;
  if (!playDayEndsNextDay(startTime, endTime)) return null;
  return `Hasta las ${endTime} del día siguiente (fecha de inicio: sin cambiar).`;
}

export function formatPlayDayDuration(
  startTime: string,
  endTime: string,
): string | null {
  if (!startTime || !endTime || !isValidPlayDayWindow(startTime, endTime)) {
    return null;
  }
  const minutes = playDayWindowMinutes(startTime, endTime);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours} h`;
  if (hours === 0) return `${remainder} min`;
  return `${hours} h ${remainder} min`;
}
