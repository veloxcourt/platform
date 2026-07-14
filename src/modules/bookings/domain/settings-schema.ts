import { z } from "zod";
import { closingMinutes, timeToMinutes } from "./rules";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/// Validación de la configuración de turnos de un club.
/// Compartida entre el formulario (cliente) y las Server Actions (servidor).
export const bookingSettingsSchema = z
  .object({
    openTime: z.string().regex(TIME_REGEX, "Hora inválida (HH:mm)"),
    closeTime: z.string().regex(TIME_REGEX, "Hora inválida (HH:mm)"),
    slotDurationMin: z
      .number()
      .int("Debe ser un número entero")
      .min(15, "Mínimo 15 minutos")
      .max(240, "Máximo 240 minutos"),
    intervalMin: z
      .number()
      .int("Debe ser un número entero")
      .min(0)
      .max(60, "Máximo 60 minutos"),
    preReservationMin: z
      .number()
      .int("Debe ser un número entero")
      .min(1, "Mínimo 1 minuto")
      .max(120, "Máximo 120 minutos"),
    requirePrePayment: z.boolean(),
    turnoProductId: z.string().min(1).nullable(),
  })
  .refine(
    (d) => closingMinutes(d.openTime, d.closeTime) > timeToMinutes(d.openTime),
    {
      message:
        "El cierre debe ser posterior a la apertura (usá 00:00 para cerrar a la medianoche)",
      path: ["closeTime"],
    },
  );

export const courtInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nombre requerido").max(50, "Máximo 50 caracteres"),
  active: z.boolean(),
});

export const turnosConfigSchema = z.object({
  settings: bookingSettingsSchema,
  courts: z
    .array(courtInputSchema)
    .min(1, "Debe haber al menos una cancha")
    .max(20, "Máximo 20 canchas"),
});

export type CourtInput = z.infer<typeof courtInputSchema>;
export type TurnosConfigValues = z.infer<typeof turnosConfigSchema>;
