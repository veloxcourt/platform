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
