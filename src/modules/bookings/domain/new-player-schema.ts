import { z } from "zod";
import { DEFAULT_PHONE_DIAL, normalizeToE164 } from "@/lib/phone";

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Masculino",
  FEMALE: "Femenino",
  OTHER: "Otro",
};

export const COURT_POSITIONS = ["DRIVE", "REVES", "AMBOS"] as const;
export type CourtPosition = (typeof COURT_POSITIONS)[number];
export const COURT_POSITION_LABELS: Record<CourtPosition, string> = {
  DRIVE: "Drive",
  REVES: "Revés",
  AMBOS: "Ambos",
};

const optionalText = (max: number) =>
  z.string().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(""));

/// Alta / ficha de un jugador del club.
export const newPlayerSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido").max(60),
  lastName: z.string().min(1, "Apellido requerido").max(60),
  phoneCountryDial: z.string().min(1),
  phoneLocal: optionalText(20),
  email: z
    .string()
    .email("Email inválido")
    .max(120)
    .optional()
    .or(z.literal("")),
  gender: z.enum(GENDERS).or(z.literal("")).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("")),
  city: optionalText(80),
  address: optionalText(120),
  country: optionalText(80),
  category: optionalText(40),
  courtPosition: z.enum(COURT_POSITIONS).or(z.literal("")).optional(),
  ranking: z
    .number()
    .int()
    .min(0, "Debe ser ≥ 0")
    .max(99999)
    .nullable(),
  accumulatedPoints: z
    .number()
    .int()
    .min(0, "Debe ser ≥ 0")
    .max(999999),
}).superRefine((data, ctx) => {
  const local = (data.phoneLocal ?? "").trim();
  if (!local) return;
  const e164 = normalizeToE164(local, data.phoneCountryDial);
  if (!e164) {
    ctx.addIssue({
      code: "custom",
      message: "Teléfono inválido. Ej: 11 2345 6789",
      path: ["phoneLocal"],
    });
  }
});

export type NewPlayerValues = z.infer<typeof newPlayerSchema>;

export function playerPhoneToE164(
  values: Pick<NewPlayerValues, "phoneCountryDial" | "phoneLocal">,
): string {
  const local = (values.phoneLocal ?? "").trim();
  if (!local) return "";
  return normalizeToE164(local, values.phoneCountryDial) ?? "";
}

export const EMPTY_PHONE_FIELDS = {
  phoneCountryDial: DEFAULT_PHONE_DIAL,
  phoneLocal: "",
} as const;
