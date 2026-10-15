import type {
  BookingType,
  PaymentStatus,
  SlotStatus,
} from "@/modules/bookings/domain/types";

type SlotPaint = { label: string; cell: string; dot: string };

/// Estilos por estado de reserva (colores de la celda del calendario).
/// Reservado es la reserva del día (azul). El turno fijo usa su propio verde.
export const SLOT_STATUS_STYLES: Record<SlotStatus, SlotPaint> = {
  DISPONIBLE: {
    label: "Disponible",
    cell: "bg-background hover:bg-muted/60 border-dashed",
    dot: "bg-muted-foreground/30",
  },
  PRE_RESERVA: {
    label: "Pre-reserva",
    cell: "bg-yellow-100 hover:bg-yellow-200 border-yellow-400 dark:bg-yellow-950/50 dark:border-yellow-700",
    dot: "bg-yellow-400",
  },
  RESERVADO: {
    label: "Reservado",
    cell: "bg-sky-100 hover:bg-sky-200 border-sky-400 dark:bg-sky-950/50 dark:border-sky-700",
    dot: "bg-sky-500",
  },
};

export const FIXED_SLOT_STYLE: SlotPaint = {
  label: "Juego (Fijo)",
  cell: "bg-emerald-100 hover:bg-emerald-200 border-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-700",
  dot: "bg-emerald-500",
};

export const CLASS_SLOT_STYLE: SlotPaint = {
  label: "Clase (No fijo)",
  cell: "bg-violet-100 hover:bg-violet-200 border-violet-400 dark:bg-violet-950/50 dark:border-violet-700",
  dot: "bg-violet-500",
};

export const FIXED_CLASS_SLOT_STYLE: SlotPaint = {
  label: "Clase (Fijo)",
  cell: "bg-orange-100 hover:bg-orange-200 border-orange-400 dark:bg-orange-950/50 dark:border-orange-700",
  dot: "bg-orange-500",
};

/// Color de una celda ocupada. Juego (No fijo) usa el color de su estado;
/// los otros tres tipos tienen color propio.
export function slotPaint(booking: {
  type: BookingType;
  status: Exclude<SlotStatus, "DISPONIBLE">;
}): SlotPaint {
  switch (booking.type) {
    case "FIJO":
      return FIXED_SLOT_STYLE;
    case "CLASE_NO_FIJO":
      return CLASS_SLOT_STYLE;
    case "CLASE_FIJO":
      return FIXED_CLASS_SLOT_STYLE;
    default:
      return SLOT_STATUS_STYLES[booking.status];
  }
}

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  NO_FIJO: "Juego (No fijo)",
  FIJO: "Juego (Fijo)",
  CLASE_NO_FIJO: "Clase (No fijo)",
  CLASE_FIJO: "Clase (Fijo)",
};

/// Opciones del selector "Tipo", en el orden en que se muestran.
export const BOOKING_TYPE_OPTIONS: BookingType[] = [
  "NO_FIJO",
  "FIJO",
  "CLASE_NO_FIJO",
  "CLASE_FIJO",
];

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  PAID: { label: "Pagado", className: "text-emerald-600 dark:text-emerald-400" },
  PARTIAL: { label: "Seña", className: "text-amber-600 dark:text-amber-400" },
  UNPAID: { label: "Sin pagar", className: "text-rose-600 dark:text-rose-400" },
};
