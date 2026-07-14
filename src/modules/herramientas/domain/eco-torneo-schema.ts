import { z } from "zod";

import {
  ECO_ENTRADA_CATEGORIES,
  ECO_SALIDA_CATEGORIES,
} from "./eco-torneo";

const ecoCategorySchema = z.enum([
  ...ECO_ENTRADA_CATEGORIES,
  ...ECO_SALIDA_CATEGORIES,
]);

export const ecoItemSchema = z.object({
  id: z.string().min(1),
  category: ecoCategorySchema,
  observacion: z.string(),
  cantidad: z.number().nullable(),
  valorCents: z.number().int().nullable(),
  porcentaje: z.number().nullable(),
  enSaldo: z.boolean(),
});

export const ecoItemsSchema = z.array(ecoItemSchema);

export const ecoSimulationNameSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre")
  .max(80, "Máximo 80 caracteres");

export type EcoItemValues = z.infer<typeof ecoItemSchema>;
