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

export const createCategorySchema = z
  .object({
    gender: z.enum(TOURNAMENT_CATEGORY_GENDER_VALUES),
    level: z.string().trim().min(1, "Elegí el valor").max(20),
  })
  .superRefine((data, ctx) => {
    if (!isSumaGender(data.gender)) return;

    const value = Number(data.level);
    if (!Number.isInteger(value) || value < 5 || value > 16) {
      ctx.addIssue({
        code: "custom",
        message: "Elegí un valor de suma entre 5 y 16",
        path: ["level"],
      });
    }
  });

export type CreateCategoryValues = z.infer<typeof createCategorySchema>;
