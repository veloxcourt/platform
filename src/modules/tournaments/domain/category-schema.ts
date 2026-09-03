import { z } from "zod";
import { normalizeCategoryLevel } from "./category-level";

export const TOURNAMENT_CATEGORY_GENDER_VALUES = [
  "FEMENINA",
  "MASCULINA",
  "MIXTA",
  "FEMENINA_SUMA",
  "MASCULINA_SUMA",
  "MIXTA_SUMA",
] as const;

export type TournamentCategoryGender =
  (typeof TOURNAMENT_CATEGORY_GENDER_VALUES)[number];

export const TOURNAMENT_CATEGORY_GENDER_LABELS: Record<
  TournamentCategoryGender,
  string
> = {
  FEMENINA: "Femenina",
  MASCULINA: "Masculina",
  MIXTA: "Mixta",
  FEMENINA_SUMA: "Femenina Suma",
  MASCULINA_SUMA: "Masculina Suma",
  MIXTA_SUMA: "Mixta Suma",
};

export const SUM_CATEGORY_VALUES = Array.from({ length: 12 }, (_, index) =>
  String(index + 5),
);

export function isSumaGender(gender: TournamentCategoryGender): boolean {
  return gender.endsWith("_SUMA");
}

export function buildCategoryName(
  gender: TournamentCategoryGender,
  level: string,
): string {
  const trimmed = normalizeCategoryLevel(level.trim());
  if (!trimmed) return TOURNAMENT_CATEGORY_GENDER_LABELS[gender];
  return `${TOURNAMENT_CATEGORY_GENDER_LABELS[gender]} ${trimmed}`;
}

export const createCategorySchema = z.object({
  catalogCategoryId: z.string().min(1, "Elegí una categoría del catálogo"),
});

export type CreateCategoryValues = z.infer<typeof createCategorySchema>;

export const renameCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribí el nombre")
    .max(80, "Máximo 80 caracteres"),
});

export type RenameCategoryValues = z.infer<typeof renameCategorySchema>;
