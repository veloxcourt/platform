import { z } from "zod";

/// Tipo de producto (maestro con CRUD).
export const productTypeSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(60, "Máximo 60 caracteres"),
});
export type ProductTypeValues = z.infer<typeof productTypeSchema>;

const optionalText = (max: number) =>
  z.string().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(""));

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
  active: z.boolean(),
});
export type ProductValues = z.infer<typeof productSchema>;
