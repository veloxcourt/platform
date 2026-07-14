import type { PaymentStatus, SlotStatus } from "@/modules/bookings/domain/types";

/// Estilos por estado de reserva (colores de la celda del calendario).
export const SLOT_STATUS_STYLES: Record<
  SlotStatus,
  { label: string; cell: string; dot: string }
> = {
  DISPONIBLE: {
    label: "Disponible",
    cell: "bg-background hover:bg-muted/60 border-dashed",
    dot: "bg-muted-foreground/30",
  },
  PRE_RESERVA: {
    label: "Pre-reserva",
    cell: "bg-amber-50 hover:bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  RESERVADO: {
    label: "Reservado",
    cell: "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  PAID: { label: "Pagado", className: "text-emerald-600 dark:text-emerald-400" },
  PARTIAL: { label: "Seña", className: "text-amber-600 dark:text-amber-400" },
  UNPAID: { label: "Sin pagar", className: "text-rose-600 dark:text-rose-400" },
};
