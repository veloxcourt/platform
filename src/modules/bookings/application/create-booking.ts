import type { BookingRepository } from "./booking-repository";
import type { CreateBookingValues } from "../domain/create-booking-schema";
import {
  dayOfWeekISO,
  findBookingAt,
  MAX_PLAYERS_PER_BOOKING,
  timeRangesOverlap,
} from "../domain/rules";

export type CommandResult = { ok: true } | { ok: false; error: string };

/// Caso de uso: crea una reserva como PRE-RESERVA.
/// Valida disponibilidad del slot y máximo de jugadores, y calcula la duración
/// y el vencimiento de la pre-reserva a partir de la configuración del club.
export async function createBooking(
  repo: BookingRepository,
  clubSlug: string,
  values: CreateBookingValues,
): Promise<CommandResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const settings = await repo.getSettings(club.id);

  const dayBookings = await repo.getBookingsForDate(club.id, values.date);
  if (findBookingAt(dayBookings, values.courtId, values.startTime)) {
    return { ok: false, error: "Ese horario ya está ocupado" };
  }

  const playerIds = Array.from(new Set(values.playerIds.filter(Boolean)));
  if (playerIds.length > MAX_PLAYERS_PER_BOOKING) {
    return {
      ok: false,
      error: `Máximo ${MAX_PLAYERS_PER_BOOKING} jugadores por turno`,
    };
  }

  // Turno FIJO: se crea una plantilla recurrente (se repite cada semana en el
  // mismo día/hora/cancha hasta que el club la cancele).
  if (values.type === "FIJO") {
    const templates = await repo.getActiveFixedBookings(club.id);
    const dow = dayOfWeekISO(values.date);
    const alreadyFixed = templates.some(
      (template) =>
        template.courtId === values.courtId &&
        template.dayOfWeek === dow &&
        timeRangesOverlap(
          template.startTime,
          template.durationMin,
          values.startTime,
          settings.slotDurationMin,
        ),
    );
    if (alreadyFixed) {
      return { ok: false, error: "Ese horario ya tiene un turno fijo" };
    }

    await repo.createFixedBooking(club.id, {
      courtId: values.courtId,
      dayOfWeek: dow,
      startTime: values.startTime,
      durationMin: settings.slotDurationMin,
      responsibleId: values.responsibleId,
      playerIds,
    });
    return { ok: true };
  }

  const expiresAt = new Date(
    Date.now() + settings.preReservationMin * 60_000,
  ).toISOString();

  await repo.createBooking(club.id, {
    courtId: values.courtId,
    date: values.date,
    startTime: values.startTime,
    durationMin: settings.slotDurationMin,
    type: values.type,
    status: "PRE_RESERVA",
    paymentStatus: values.paymentStatus,
    // El precio del turno es autoritativo desde el catálogo (producto configurado),
    // no desde el cliente.
    price: settings.bookingPrice,
    responsibleId: values.responsibleId,
    playerIds,
    expiresAt,
    createdById: values.responsibleId,
  });

  return { ok: true };
}
