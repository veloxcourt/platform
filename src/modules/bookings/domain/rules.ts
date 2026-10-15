import type {
  Booking,
  BookingSettings,
  BookingType,
  FixedBookingTemplate,
  FixedBookingType,
  PlayerRef,
  ReleasedFixedSlot,
} from "./types";

/// Juego (Fijo) y Clase (Fijo) se repiten cada semana.
export function isFixedType(type: BookingType): type is FixedBookingType {
  return type === "FIJO" || type === "CLASE_FIJO";
}

export function isClassType(type: BookingType): boolean {
  return type === "CLASE_FIJO" || type === "CLASE_NO_FIJO";
}

/// Convierte "HH:mm" a minutos desde la medianoche.
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/// Convierte minutos desde la medianoche a "HH:mm".
export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/// Minutos de cierre "efectivos". Si la hora de cierre es menor o igual a la de
/// apertura (ej. cierre 00:00), se interpreta como cierre pasada la medianoche
/// (se le suman 24 h). Así el cierre siempre queda después de la apertura.
export function closingMinutes(openTime: string, closeTime: string): number {
  const open = timeToMinutes(openTime);
  let close = timeToMinutes(closeTime);
  if (close < open) close += 24 * 60;
  return close;
}

/// Genera los horarios de inicio disponibles según la configuración del club.
/// Un turno es válido si termina a más tardar en la hora de cierre (que puede
/// caer en la medianoche). El turno pertenece al día en que comienza.
export function generateTimeSlots(settings: BookingSettings): string[] {
  const start = timeToMinutes(settings.openTime);
  const end = closingMinutes(settings.openTime, settings.closeTime);
  const step = settings.slotDurationMin + settings.intervalMin;
  const slots: string[] = [];

  for (let t = start; t + settings.slotDurationMin <= end; t += step) {
    slots.push(minutesToTime(t % (24 * 60)));
  }
  return slots;
}

/// Busca la reserva que ocupa un (cancha, horario) puntual.
export function findBookingAt(
  bookings: Booking[],
  courtId: string,
  slot: string,
): Booking | undefined {
  const slotStart = timeToMinutes(slot);
  return bookings.find((b) => {
    if (b.courtId !== courtId) return false;
    const bStart = timeToMinutes(b.startTime);
    const bEnd = bStart + b.durationMin;
    return slotStart >= bStart && slotStart < bEnd;
  });
}

/// Regla de negocio: máximo de jugadores por turno (responsable incluido).
export const MAX_PLAYERS_PER_BOOKING = 4;

/// Dos rangos horarios del mismo día se pisan.
export function timeRangesOverlap(
  startA: string,
  durationAMin: number,
  startB: string,
  durationBMin: number,
): boolean {
  const a = timeToMinutes(startA);
  const b = timeToMinutes(startB);
  return a < b + durationBMin && b < a + durationAMin;
}

/// Indica si una pre-reserva está vencida respecto a un instante dado.
export function isPreReservationExpired(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() < now.getTime();
}

/// Día de la semana (0 dom .. 6 sáb) de una fecha "YYYY-MM-DD".
export function dayOfWeekISO(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00`).getDay();
}

// --- Turnos fijos: ocurrencias virtuales ---

const FIXED_ID_PREFIX = "fixed:";

/// Id sintético de una ocurrencia virtual de turno fijo.
export function fixedOccurrenceId(templateId: string, dateISO: string): string {
  return `${FIXED_ID_PREFIX}${templateId}:${dateISO}`;
}

export function isFixedOccurrenceId(id: string): boolean {
  return id.startsWith(FIXED_ID_PREFIX);
}

/// Extrae el id de la plantilla desde el id de una ocurrencia virtual.
export function templateIdFromOccurrence(id: string): string {
  return id.split(":")[1] ?? "";
}

/// Jugadores que se ven en el calendario. Hasta que el club los guarda,
/// se muestra el responsable.
export function visibleFixedPlayers(template: {
  responsible: PlayerRef;
  players?: PlayerRef[];
  playersSet?: boolean;
}): PlayerRef[] {
  if (template.playersSet) return template.players ?? [];
  if (template.players && template.players.length > 0) return template.players;
  return [template.responsible];
}

/// Expande plantillas de turnos fijos en reservas "virtuales" para las fechas dadas.
/// Cada plantilla aparece en las fechas cuyo día de semana coincide, desde su
/// fecha de inicio en adelante (mientras la plantilla siga activa).
/// Las fechas liberadas no ocupan el horario: la serie sigue, ese día está libre.
export function expandFixedBookings(
  templates: FixedBookingTemplate[],
  dates: string[],
): Booking[] {
  const out: Booking[] = [];
  for (const t of templates) {
    const released = new Set(t.releasedDates ?? []);
    for (const date of dates) {
      if (date < t.startDate) continue;
      if (dayOfWeekISO(date) !== t.dayOfWeek) continue;
      if (released.has(date)) continue;
      out.push({
        id: fixedOccurrenceId(t.id, date),
        courtId: t.courtId,
        date,
        startTime: t.startTime,
        durationMin: t.durationMin,
        type: t.type,
        status: "RESERVADO",
        paymentStatus: "UNPAID",
        price: 0,
        impacted: false,
        responsible: t.responsible,
        players: visibleFixedPlayers(t),
      });
    }
  }
  return out;
}

/// Fechas liberadas de turnos fijos que caen en el rango pedido.
export function releasedFixedSlots(
  templates: FixedBookingTemplate[],
  dates: string[],
): ReleasedFixedSlot[] {
  const wanted = new Set(dates);
  const out: ReleasedFixedSlot[] = [];
  for (const t of templates) {
    for (const date of t.releasedDates ?? []) {
      if (!wanted.has(date)) continue;
      if (date < t.startDate) continue;
      if (dayOfWeekISO(date) !== t.dayOfWeek) continue;
      out.push({
        fixedBookingId: t.id,
        courtId: t.courtId,
        date,
        startTime: t.startTime,
        durationMin: t.durationMin,
        type: t.type,
        responsible: t.responsible,
      });
    }
  }
  return out;
}

/// Liberación que cubre un (cancha, horario). Si hay fecha, sólo esa.
export function findReleasedFixedAt(
  releases: ReleasedFixedSlot[],
  courtId: string,
  slot: string,
  date?: string,
): ReleasedFixedSlot | undefined {
  const slotStart = timeToMinutes(slot);
  return releases.find((release) => {
    if (release.courtId !== courtId) return false;
    if (date && release.date !== date) return false;
    const start = timeToMinutes(release.startTime);
    return slotStart >= start && slotStart < start + release.durationMin;
  });
}

/// Qué muestra una celda: la reserva, o el turno fijo liberado si el hueco está libre.
/// Con "solo fijos", una reserva común oculta no deja ver una liberación que esté debajo.
export function calendarCellAt(
  bookings: Booking[],
  releases: ReleasedFixedSlot[],
  courtId: string,
  slot: string,
  options?: { date?: string; onlyFixed?: boolean },
): { booking: Booking | null; released: ReleasedFixedSlot | null } {
  const booking = findBookingAt(bookings, courtId, slot);
  if (booking) {
    if (options?.onlyFixed && !isFixedType(booking.type)) {
      return { booking: null, released: null };
    }
    return { booking, released: null };
  }
  return {
    booking: null,
    released:
      findReleasedFixedAt(releases, courtId, slot, options?.date) ?? null,
  };
}
