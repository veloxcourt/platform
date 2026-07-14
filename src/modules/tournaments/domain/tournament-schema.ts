import { z } from "zod";

import { TOURNAMENT_TYPES } from "./tournament-types";

export const TOURNAMENT_STATUS_VALUES = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "FINISHED",
] as const;

export const TOURNAMENT_STATUS_LABELS: Record<
  (typeof TOURNAMENT_STATUS_VALUES)[number],
  string
> = {
  DRAFT: "Borrador",
  OPEN: "Inscripciones abiertas",
  CLOSED: "Inscripciones cerradas",
  FINISHED: "Finalizado",
};

const dateISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const createTournamentSchema = z
  .object({
    type: z.enum(TOURNAMENT_TYPES),
    name: z.string().trim().min(1, "Ingresá el nombre del torneo").max(120),
    description: z.string().trim().max(500).optional().default(""),
    startDate: dateISO,
    endDate: dateISO.optional().nullable(),
    fee: z.number().int().min(0).default(0),
    status: z.enum(TOURNAMENT_STATUS_VALUES).default("DRAFT"),
  })
  .refine(
    (data) =>
      !data.endDate || data.endDate >= data.startDate,
    { message: "La fecha de fin no puede ser anterior al inicio", path: ["endDate"] },
  );

export type CreateTournamentValues = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá el nombre del torneo").max(120),
    description: z.string().trim().max(500).optional().default(""),
    startDate: dateISO,
    endDate: dateISO.optional().nullable(),
    fee: z.number().int().min(0).default(0),
    status: z.enum(TOURNAMENT_STATUS_VALUES).default("DRAFT"),
  })
  .refine(
    (data) =>
      !data.endDate || data.endDate >= data.startDate,
    { message: "La fecha de fin no puede ser anterior al inicio", path: ["endDate"] },
  );

export type UpdateTournamentValues = z.infer<typeof updateTournamentSchema>;
