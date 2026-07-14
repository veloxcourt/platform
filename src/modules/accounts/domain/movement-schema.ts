import { z } from "zod";

/// Validación para cargar un movimiento (compra o pago) en la cuenta.
export const addMovementSchema = z.object({
  type: z.enum(["CHARGE", "PAYMENT"]),
  amount: z
    .number({ message: "Ingresá un monto" })
    .int("El monto debe ser entero")
    .positive("El monto debe ser mayor a 0")
    .max(100_000_000, "Monto demasiado grande"),
  concept: z.string().max(120, "Máximo 120 caracteres").optional().or(z.literal("")),
  method: z.enum(["CASH", "TRANSFER", "CARD"]).or(z.literal("")).optional(),
});

export type AddMovementValues = z.infer<typeof addMovementSchema>;
