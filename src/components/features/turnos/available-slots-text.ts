import { calendarCellAt } from "@/modules/bookings/domain/rules";
import type {
  Booking,
  Court,
  ReleasedFixedSlot,
} from "@/modules/bookings/domain/types";

export interface AvailableSlotsTextInput {
  intro: string;
  dateISO: string;
  courts: Court[];
  slots: string[];
  bookings: Booking[];
  releasedSlots: ReleasedFixedSlot[];
}

export interface AvailableSlotsText {
  text: string;
  freeCount: number;
}

/// Texto para que quien gestiona turnos lo pegue en WhatsApp.
/// La primera línea es el texto configurado. Después, los horarios de inicio
/// libres, una sola vez: si el mismo horario está libre en varias canchas,
/// no se repite ni se nombra la cancha.
export function buildAvailableSlotsText(
  input: AvailableSlotsTextInput,
): AvailableSlotsText {
  const freeTimes = input.slots.filter((slot) =>
    input.courts.some((court) => {
      const cell = calendarCellAt(
        input.bookings,
        input.releasedSlots,
        court.id,
        slot,
        { date: input.dateISO },
      );
      return cell.booking == null;
    }),
  );

  const intro = input.intro.trim();
  const disponibles =
    freeTimes.length === 0
      ? "No hay turnos libres."
      : `Disponibles: ${freeTimes.join(" - ")}`;

  return {
    text: intro ? `${intro}\n${disponibles}` : disponibles,
    freeCount: freeTimes.length,
  };
}
