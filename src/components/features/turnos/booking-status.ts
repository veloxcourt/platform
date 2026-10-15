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
  label: "Turno fijo",
  cell: "bg-emerald-100 hover:bg-emerald-200 border-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-700",
  dot: "bg-emerald-500",
};

/// Color de una celda ocupada: el fijo es verde aunque el estado sea reservado.
export function slotPaint(booking: {
  type: BookingType;
  status: Exclude<SlotStatus, "DISPONIBLE">;
}): SlotPaint {
  if (booking.type === "FIJO") return FIXED_SLOT_STYLE;
  return SLOT_STATUS_STYLES[booking.status];
}

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  PAID: { label: "Pagado", className: "text-emerald-600 dark:text-emerald-400" },
  PARTIAL: { label: "Seña", className: "text-amber-600 dark:text-amber-400" },
  UNPAID: { label: "Sin pagar", className: "text-rose-600 dark:text-rose-400" },
};
