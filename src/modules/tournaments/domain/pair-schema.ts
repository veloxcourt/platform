import { z } from "zod";

const pairFormBaseSchema = z.object({
  player1Id: z.string().min(1, "Elegí el jugador"),
  player2Id: z.string().optional(),
  categoryId: z.string().min(1, "Elegí la categoría del torneo"),
});

function normalizePairForm(data: z.infer<typeof pairFormBaseSchema>) {
  const player2Id = data.player2Id?.trim() ? data.player2Id : undefined;
  return { ...data, player2Id };
}

export const addPairSchema = pairFormBaseSchema
  .transform(normalizePairForm)
  .refine((data) => !data.player2Id || data.player1Id !== data.player2Id, {
    message: "Los dos jugadores deben ser distintos",
    path: ["player2Id"],
  });

export const updatePairSchema = addPairSchema;

export type AddPairValues = z.infer<typeof addPairSchema>;
export type UpdatePairValues = z.infer<typeof updatePairSchema>;

export const REGISTRATION_STATUS_LABELS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
} as const;
