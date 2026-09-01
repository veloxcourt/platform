import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido");

const dateISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const calendarVenueSchema = z.object({
  name: z.string().trim().min(1, "Escribí el nombre").max(80),
  color: hexColor,
});

export const calendarCategorySchema = z.object({
  name: z.string().trim().min(1, "Escribí el nombre").max(80),
  abbreviation: z
    .string()
    .trim()
    .min(1, "Escribí la abreviación")
    .max(6)
    .transform((v) => v.toUpperCase()),
  color: hexColor,
});

export const plannedTournamentSchema = z
  .object({
    name: z.string().trim().max(80),
    clubId: z.string().min(1, "Elegí un club"),
    startDate: dateISO,
    endDate: dateISO,
    categoryIds: z.array(z.string().min(1)),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "La fecha de fin no puede ser anterior al inicio",
    path: ["endDate"],
  });

export const calendarSettingsSchema = z.object({
  libreFill: hexColor,
  libreBorder: hexColor,
});

export const calendarVenueOrderSchema = z
  .array(z.string().min(1))
  .min(1, "Orden inválido");

export const calendarSearchLinkSchema = z.object({
  name: z.string().trim().min(1, "Escribí el nombre").max(80),
  url: z
    .string()
    .trim()
    .min(1, "Pegá el enlace")
    .max(300)
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .refine((v) => {
      try {
        return Boolean(new URL(v));
      } catch {
        return false;
      }
    }, "Enlace inválido"),
  description: z.string().trim().max(160),
});

export type CalendarVenueValues = z.infer<typeof calendarVenueSchema>;
export type CalendarCategoryValues = z.infer<typeof calendarCategorySchema>;
export type PlannedTournamentValues = z.infer<typeof plannedTournamentSchema>;
export type CalendarSettingsValues = z.infer<typeof calendarSettingsSchema>;
export type CalendarSearchLinkValues = z.infer<typeof calendarSearchLinkSchema>;
