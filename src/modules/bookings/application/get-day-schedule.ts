import type { BookingRepository } from "./booking-repository";
import type { DaySchedule } from "../domain/types";
import { generateTimeSlots } from "../domain/rules";

/// Caso de uso: arma la agenda de turnos de un día para un club.
/// Acotado por club (multi-tenant): resuelve el club por su slug.
export async function getDaySchedule(
  repo: BookingRepository,
  clubSlug: string,
  date: string,
): Promise<DaySchedule | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const [courts, settings, bookings, players, categories] = await Promise.all([
    repo.getCourts(club.id),
    repo.getSettings(club.id),
    repo.getBookingsForDate(club.id, date),
    repo.getPlayers(club.id),
    repo.getClubCategories(club.id),
  ]);

  return {
    club,
    date,
    settings,
    courts: courts.filter((c) => c.active).sort((a, b) => a.order - b.order),
    slots: generateTimeSlots(settings),
    bookings,
    players,
    categories,
  };
}
