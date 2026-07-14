import type { BookingRepository } from "./booking-repository";
import type { DayColumn, WeekSchedule } from "../domain/types";
import { generateTimeSlots } from "../domain/rules";
import { addDaysISO, dowOf, formatWeekday, getWeekStartISO } from "@/lib/date";

/// Caso de uso: agenda semanal de un club (días, horarios, canchas y reservas).
/// La grilla por cancha se arma en el cliente.
export async function getWeekSchedule(
  repo: BookingRepository,
  clubSlug: string,
  dateISO: string,
): Promise<WeekSchedule | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const [settings, courts, players, categories] = await Promise.all([
    repo.getSettings(club.id),
    repo.getCourts(club.id),
    repo.getPlayers(club.id),
    repo.getClubCategories(club.id),
  ]);
  const activeCourts = courts
    .filter((c) => c.active)
    .sort((a, b) => a.order - b.order);

  const weekStart = getWeekStartISO(dateISO);
  const days: DayColumn[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(weekStart, i);
    const dow = dowOf(date);
    return {
      date,
      dow,
      label: formatWeekday(date),
      isWeekend: dow === 0 || dow === 6,
    };
  });

  const bookings = await repo.getBookingsForRange(
    club.id,
    days[0].date,
    days[6].date,
  );

  return {
    club,
    weekStart,
    days,
    slots: generateTimeSlots(settings),
    courts: activeCourts,
    bookings,
    players,
    categories,
    requirePrePayment: settings.requirePrePayment,
    bookingPrice: settings.bookingPrice,
  };
}
