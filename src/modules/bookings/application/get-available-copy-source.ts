import { addDaysISO, todayISO } from "@/lib/date";
import { generateTimeSlots } from "../domain/rules";
import type {
  Booking,
  Court,
  ReleasedFixedSlot,
} from "../domain/types";
import type { BookingRepository } from "./booking-repository";

/// Datos de hoy y mañana para armar el texto de turnos libres.
/// No depende del día o la semana que se está mirando en el calendario.
export interface AvailableCopySource {
  today: string;
  intro: string;
  courts: Court[];
  slots: string[];
  bookings: Booking[];
  releasedSlots: ReleasedFixedSlot[];
}

export async function getAvailableCopySource(
  repo: BookingRepository,
  clubSlug: string,
): Promise<AvailableCopySource | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const [courts, settings, bookings, releasedSlots] = await Promise.all([
    repo.getCourts(club.id),
    repo.getSettings(club.id),
    repo.getBookingsForRange(club.id, today, tomorrow),
    repo.getReleasedFixedSlots(club.id, today, tomorrow),
  ]);

  return {
    today,
    intro: settings.availabilityIntro,
    courts: courts.filter((c) => c.active).sort((a, b) => a.order - b.order),
    slots: generateTimeSlots(settings),
    bookings,
    releasedSlots,
  };
}
