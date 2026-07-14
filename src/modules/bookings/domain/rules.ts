import type { Booking, BookingSettings, FixedBookingTemplate } from "./types";

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

/// Expande plantillas de turnos fijos en reservas "virtuales" para las fechas dadas.
/// Cada plantilla aparece en las fechas cuyo día de semana coincide, desde su
/// fecha de inicio en adelante (mientras la plantilla siga activa).
export function expandFixedBookings(
  templates: FixedBookingTemplate[],
  dates: string[],
): Booking[] {
  const out: Booking[] = [];
  for (const t of templates) {
    for (const date of dates) {
      if (date < t.startDate) continue;
      if (dayOfWeekISO(date) !== t.dayOfWeek) continue;
      out.push({
        id: fixedOccurrenceId(t.id, date),
        courtId: t.courtId,
        date,
        startTime: t.startTime,
        durationMin: t.durationMin,
        type: "FIJO",
        status: "RESERVADO",
        paymentStatus: "UNPAID",
        price: 0,
        impacted: false,
        responsible: t.responsible,
        players: [t.responsible],
      });
    }
  }
  return out;
}
