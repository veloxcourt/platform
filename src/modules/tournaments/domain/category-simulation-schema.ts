import { z } from "zod";

export const updateCategorySimulationSchema = z.object({
  simulationEnabled: z.boolean(),
  simulationConfirmedCount: z
    .number()
    .int()
    .min(0, "Mínimo 0")
    .max(256, "Máximo 256")
    .nullable(),
});

export type UpdateCategorySimulationValues = z.infer<
  typeof updateCategorySimulationSchema
>;

/** Parejas que usa la simulación / llave oficial de una categoría. */
export function simulationPairCount(category: {
  simulationConfirmedCount?: number | null;
  confirmedCount: number;
}): number {
  if (category.simulationConfirmedCount != null) {
    return category.simulationConfirmedCount;
  }
  return Math.max(category.confirmedCount, 8);
}
