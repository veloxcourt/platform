import { z } from "zod";
import { normalizeToE164 } from "@/lib/phone";
import {
  COURT_POSITIONS,
  GENDERS,
} from "@/modules/bookings/domain/new-player-schema";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(""));

/// Alta pública: solo datos que la persona puede completar sola.
export const publicPlayerSignupSchema = z
  .object({
    clubSlug: z.string().trim().min(1),
    firstName: z.string().trim().min(1, "Nombre requerido").max(60),
    lastName: z.string().trim().min(1, "Apellido requerido").max(60),
    phoneCountryDial: z.string().min(1),
    phoneLocal: z.string().trim().min(1, "Teléfono requerido").max(20),
    email: z
      .string()
      .trim()
      .email("Email inválido")
      .max(120)
      .optional()
      .or(z.literal("")),
    instagram: optionalText(80),
    gender: z.enum(GENDERS).or(z.literal("")).optional(),
    city: optionalText(80),
    category: optionalText(40),
    courtPosition: z.enum(COURT_POSITIONS).or(z.literal("")).optional(),
  })
  .superRefine((data, ctx) => {
    const e164 = normalizeToE164(data.phoneLocal, data.phoneCountryDial);
    if (!e164) {
      ctx.addIssue({
        code: "custom",
        message: "Teléfono inválido. Ej: 11 2345 6789",
        path: ["phoneLocal"],
      });
    }
  });

export type PublicPlayerSignupValues = z.infer<typeof publicPlayerSignupSchema>;

export function publicPlayerSignupPath(clubSlug: string) {
  return `/alta/${clubSlug}`;
}
