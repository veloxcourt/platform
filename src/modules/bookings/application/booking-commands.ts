import type { BookingRepository } from "./booking-repository";
import { overlapsFixedTemplate, type CommandResult } from "./create-booking";
import type {
  BookingType,
  PaymentStatus,
  UpdateBookingData,
} from "../domain/types";
import {
  dayOfWeekISO,
  isFixedType,
  MAX_PLAYERS_PER_BOOKING,
} from "../domain/rules";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/// Edición de un turno fijo desde el calendario. Si el tipo pasa a no fijo,
/// la serie termina y queda una reserva sola para la fecha tocada.
export interface EditFixedBookingInput {
  type: BookingType;
  responsibleId: string;
  playerIds: string[];
}

/// Confirma una pre-reserva (PRE_RESERVA -> RESERVADO).
export async function confirmBooking(
  repo: BookingRepository,
  clubSlug: string,
  bookingId: string,
): Promise<CommandResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  await repo.confirmBooking(club.id, bookingId);
  return { ok: true };
}

/// Cancela una reserva.
export async function cancelBooking(
  repo: BookingRepository,
  clubSlug: string,
  bookingId: string,
): Promise<CommandResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  await repo.cancelBooking(club.id, bookingId);
  return { ok: true };
}

/// Edita una reserva completa: tipo, responsable, jugadores, estado y pago.
/// Si una reserva no fija pasa a fija, se crea la serie desde su fecha y la
/// reserva suelta se cancela.
export async function updateBooking(
  repo: BookingRepository,
  clubSlug: string,
  bookingId: string,
  date: string,
  data: UpdateBookingData,
): Promise<CommandResult> {
  if (!ISO_DATE.test(date)) return { ok: false, error: "Fecha inválida" };
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  if (!data.responsibleId) return { ok: false, error: "Elegí un responsable" };

  const playerIds = Array.from(new Set(data.playerIds.filter(Boolean)));
  if (playerIds.length > MAX_PLAYERS_PER_BOOKING) {
    return {
      ok: false,
      error: `Máximo ${MAX_PLAYERS_PER_BOOKING} jugadores por turno`,
    };
  }

  if (isFixedType(data.type)) {
    const dayBookings = await repo.getBookingsForDate(club.id, date);
    const existing = dayBookings.find((booking) => booking.id === bookingId);
    if (!existing) return { ok: false, error: "No se encontró el turno" };

    if (!isFixedType(existing.type)) {
      if (existing.impacted) {
        return {
          ok: false,
          error:
            "El turno ya se cargó en la cuenta del responsable. Cancelalo y creá el turno fijo de nuevo.",
        };
      }
      const templates = await repo.getActiveFixedBookings(club.id);
      if (overlapsFixedTemplate(templates, existing)) {
        return { ok: false, error: "Ese horario ya tiene un turno fijo" };
      }
      await repo.createFixedBooking(club.id, {
        courtId: existing.courtId,
        dayOfWeek: dayOfWeekISO(existing.date),
        startTime: existing.startTime,
        durationMin: existing.durationMin,
        type: data.type,
        responsibleId: data.responsibleId,
        playerIds,
        startDate: existing.date,
      });
      await repo.cancelBooking(club.id, bookingId);
      return { ok: true };
    }
  }

  await repo.updateBooking(club.id, bookingId, {
    ...data,
    playerIds,
    status: isFixedType(data.type) ? "RESERVADO" : data.status,
  });
  return { ok: true };
}

/// Cambia el estado de una reserva (permite revertir RESERVADO -> PRE_RESERVA).
export async function setBookingStatus(
  repo: BookingRepository,
  clubSlug: string,
  bookingId: string,
  status: "PRE_RESERVA" | "RESERVADO",
): Promise<CommandResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  await repo.setBookingStatus(club.id, bookingId, status);
  return { ok: true };
}

/// Cambia tipo, responsable y jugadores de un turno fijo. Vale para toda la serie.
/// Si el tipo pasa a no fijo, la serie termina y `date` queda como reserva suelta.
export async function updateFixedBooking(
  repo: BookingRepository,
  clubSlug: string,
  fixedBookingId: string,
  date: string,
  data: EditFixedBookingInput,
): Promise<CommandResult> {
  if (!ISO_DATE.test(date)) return { ok: false, error: "Fecha inválida" };
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  if (!data.responsibleId) return { ok: false, error: "Elegí un responsable" };

  const playerIds = Array.from(new Set(data.playerIds.filter(Boolean)));
  if (playerIds.length > MAX_PLAYERS_PER_BOOKING) {
    return {
      ok: false,
      error: `Máximo ${MAX_PLAYERS_PER_BOOKING} jugadores por turno`,
    };
  }

  if (!isFixedType(data.type)) {
    const templates = await repo.getActiveFixedBookings(club.id);
    const template = templates.find((item) => item.id === fixedBookingId);
    if (!template) return { ok: false, error: "No se encontró el turno fijo" };
    if (dayOfWeekISO(date) !== template.dayOfWeek || date < template.startDate) {
      return { ok: false, error: "La fecha no corresponde a este turno fijo" };
    }
    const settings = await repo.getSettings(club.id);
    await repo.createBooking(club.id, {
      courtId: template.courtId,
      date,
      startTime: template.startTime,
      durationMin: template.durationMin,
      type: data.type,
      status: "RESERVADO",
      paymentStatus: "UNPAID",
      price: settings.bookingPrice,
      responsibleId: data.responsibleId,
      playerIds,
      expiresAt: null,
      createdById: data.responsibleId,
    });
    await repo.cancelFixedBooking(club.id, fixedBookingId);
    return { ok: true };
  }

  const result = await repo.updateFixedBooking(club.id, fixedBookingId, {
    type: data.type,
    responsibleId: data.responsibleId,
    playerIds,
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "No se pudo guardar" };
  }
  return { ok: true };
}

/// Libera una sola fecha de un turno fijo. La serie sigue las demás semanas.
export async function releaseFixedOccurrence(
  repo: BookingRepository,
  clubSlug: string,
  fixedBookingId: string,
  date: string,
): Promise<CommandResult> {
  if (!ISO_DATE.test(date)) return { ok: false, error: "Fecha inválida" };
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const result = await repo.releaseFixedOccurrence(club.id, fixedBookingId, date);
  if (!result.ok) return { ok: false, error: result.error ?? "No se pudo liberar" };
  return { ok: true };
}

/// Devuelve al dueño una fecha que estaba liberada, si el horario sigue libre.
export async function restoreFixedOccurrence(
  repo: BookingRepository,
  clubSlug: string,
  fixedBookingId: string,
  date: string,
): Promise<CommandResult> {
  if (!ISO_DATE.test(date)) return { ok: false, error: "Fecha inválida" };
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const result = await repo.restoreFixedOccurrence(club.id, fixedBookingId, date);
  if (!result.ok) {
    return { ok: false, error: result.error ?? "No se pudo devolver el turno" };
  }
  return { ok: true };
}

/// Cancela una serie de turno fijo (deja de repetirse desde ahora).
export async function cancelFixedBooking(
  repo: BookingRepository,
  clubSlug: string,
  fixedBookingId: string,
): Promise<CommandResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  await repo.cancelFixedBooking(club.id, fixedBookingId);
  return { ok: true };
}

/// Actualiza el estado de pago de una reserva.
export async function setBookingPayment(
  repo: BookingRepository,
  clubSlug: string,
  bookingId: string,
  status: PaymentStatus,
): Promise<CommandResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  await repo.setBookingPayment(club.id, bookingId, status);
  return { ok: true };
}
