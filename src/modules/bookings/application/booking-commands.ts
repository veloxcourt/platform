import type { BookingRepository } from "./booking-repository";
import type { CommandResult } from "./create-booking";
import type {
  PaymentStatus,
  UpdateBookingData,
  UpdateFixedBookingData,
} from "../domain/types";
import { MAX_PLAYERS_PER_BOOKING } from "../domain/rules";

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

/// Edita una reserva completa: responsable, jugadores, estado y pago.
export async function updateBooking(
  repo: BookingRepository,
  clubSlug: string,
  bookingId: string,
  data: UpdateBookingData,
): Promise<CommandResult> {
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

  await repo.updateBooking(club.id, bookingId, { ...data, playerIds });
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

/// Cambia responsable y jugadores de un turno fijo. Vale para toda la serie.
export async function updateFixedBooking(
  repo: BookingRepository,
  clubSlug: string,
  fixedBookingId: string,
  data: UpdateFixedBookingData,
): Promise<CommandResult> {
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

  const result = await repo.updateFixedBooking(club.id, fixedBookingId, {
    responsibleId: data.responsibleId,
    playerIds,
  });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "No se pudo guardar" };
  }
  return { ok: true };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
