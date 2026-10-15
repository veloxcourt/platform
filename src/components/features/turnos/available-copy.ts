import { addDaysISO, formatWeekdayName } from "@/lib/date";
import type {
  Booking,
  Court,
  ReleasedFixedSlot,
} from "@/modules/bookings/domain/types";
import { buildAvailableSlotsText } from "./available-slots-text";

export interface AvailableCopySource {
  intro: string;
  courts: Court[];
  slots: string[];
  bookings: Booking[];
  releasedSlots: ReleasedFixedSlot[];
}

export interface AvailableCopyOption {
  dateISO: string;
  label: string;
  text: string;
  freeCount: number;
}

function prettyWeekday(dateISO: string): string {
  const name = formatWeekdayName(dateISO);
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/// Dos textos de WhatsApp: el de hoy y el de mañana, según la fecha de hoy.
export function buildAvailableCopyOptions(
  source: AvailableCopySource,
  today: string,
): AvailableCopyOption[] {
  const days = [
    { dateISO: today, prefix: "Disponibles hoy" },
    { dateISO: addDaysISO(today, 1), prefix: "Disponibles Mañana" },
  ];

  return days.map(({ dateISO, prefix }) => {
    const weekday = prettyWeekday(dateISO);
    const label = weekday ? `${prefix} (${weekday})` : prefix;
    const built = buildAvailableSlotsText({
      intro: source.intro,
      dateISO,
      heading: label,
      courts: source.courts,
      slots: source.slots,
      bookings: source.bookings.filter((booking) => booking.date === dateISO),
      releasedSlots: source.releasedSlots,
    });
    return {
      dateISO,
      label,
      text: built.text,
      freeCount: built.freeCount,
    };
  });
}
