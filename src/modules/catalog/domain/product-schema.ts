import { z } from "zod";

/// Tipo de producto (maestro con CRUD).
export const productTypeSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(60, "Máximo 60 caracteres"),
});
export type ProductTypeValues = z.infer<typeof productTypeSchema>;

const optionalText = (max: number) =>
  z.string().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(""));

export const PRODUCT_UNITS = ["u", "g", "kg", "ml", "l"] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const productComponentSchema = z.object({
  componentId: z.string().min(1),
  quantity: z.number().positive().max(1_000_000),
});
export type ProductComponentValues = z.infer<typeof productComponentSchema>;

/// Producto. Valores monetarios ya en centavos; marginPct ya ×100.
export const productSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  code: optionalText(40),
  description: optionalText(300),
  notes: optionalText(300),
  typeId: z.string().optional().or(z.literal("")),
  cost: z.number().int().min(0).max(1_000_000_000),
  marginPct: z.number().int().min(0).max(1_000_000),
  price: z.number().int().min(0).max(1_000_000_000),
  rounding: z.number().int().min(0).max(10_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  isComposite: z.boolean(),
  baseQuantity: z.number().positive().max(1_000_000).default(1),
  unit: z.enum(PRODUCT_UNITS).default("u"),
  active: z.boolean(),
  components: z.array(productComponentSchema).default([]),
});
export type ProductValues = z.infer<typeof productSchema>;
