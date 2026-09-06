import { z } from "zod";

import {
  ECO_ENTRADA_CATEGORIES,
  ECO_SALIDA_CATEGORIES,
} from "./eco-torneo";
import type { EcoGroup, EcoItem } from "./eco-torneo";

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

export const ecoGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  itemIds: z.array(z.string().min(1)),
});

export const ecoGroupsSchema = z.array(ecoGroupSchema);

export const ecoPlanillaPayloadSchema = z.object({
  items: ecoItemsSchema,
  groups: ecoGroupsSchema,
});

export function parseEcoPlanillaPayload(raw: unknown): {
  items: EcoItem[];
  groups: EcoGroup[];
} {
  if (Array.isArray(raw)) {
    const items = ecoItemsSchema.safeParse(raw);
    return { items: items.success ? items.data : [], groups: [] };
  }
  const parsed = ecoPlanillaPayloadSchema.safeParse(raw);
  if (!parsed.success) return { items: [], groups: [] };
  return parsed.data;
}

export const ecoSimulationNameSchema = z
  .string()
  .trim()
  .min(1, "Ingresá un nombre")
  .max(80, "Máximo 80 caracteres");

export type EcoItemValues = z.infer<typeof ecoItemSchema>;
