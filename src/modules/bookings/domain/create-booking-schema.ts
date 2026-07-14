import { z } from "zod";

/// Validación de entrada para crear una reserva (form del cliente + Server Action).
export const createBookingSchema = z.object({
  courtId: z.string().min(1, "Cancha requerida"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida"),
  type: z.enum(["FIJO", "NO_FIJO"]),
  responsibleId: z.string().min(1, "Elegí un responsable"),
  playerIds: z.array(z.string()).max(4, "Máximo 4 jugadores"),
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]),
  price: z.number().int().min(0).max(100_000_000),
});

export type CreateBookingValues = z.infer<typeof createBookingSchema>;
