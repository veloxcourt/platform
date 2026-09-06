import { z } from "zod";

import { isValidPlayDayWindow } from "./play-day";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const MATCH_FORMAT_VALUES = [
  "ONE_SET_6",
  "ONE_SET_9",
  "TWO_SETS_STB",
  "BEST_OF_3",
] as const;

export type MatchFormat = (typeof MATCH_FORMAT_VALUES)[number];

export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  ONE_SET_6: "1 set a 6 juegos",
  ONE_SET_9: "1 set a 9 juegos",
  TWO_SETS_STB: "2 sets + super tie-break",
  BEST_OF_3: "Mejor de 3 sets",
};

/// Instancia desde la cual comienza la fase final (define qué rondas van en la fase intermedia).
export const FINAL_PHASE_START_ROUND_VALUES = [
  "ROUND_32",
  "ROUND_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
] as const;

export type FinalPhaseStartRound =
  (typeof FINAL_PHASE_START_ROUND_VALUES)[number];

export const FINAL_PHASE_START_ROUND_LABELS: Record<
  FinalPhaseStartRound,
  string
> = {
  ROUND_32: "16 avos",
  ROUND_16: "Octavos",
  QUARTER_FINALS: "Cuartos",
  SEMI_FINALS: "Semifinal",
};

/// Todas las instancias configurables de llave (intermedia + final).
export const BRACKET_ROUND_VALUES = [
  "ROUND_64",
  ...FINAL_PHASE_START_ROUND_VALUES,
  "FINAL",
] as const;

export type BracketRound = (typeof BRACKET_ROUND_VALUES)[number];

export const BRACKET_ROUND_LABELS: Record<BracketRound, string> = {
  ROUND_64: "32 avos",
  ...FINAL_PHASE_START_ROUND_LABELS,
  FINAL: "Final",
};

/// Fases del torneo por zonas (cada una puede tener formato y duración distintos).
export const TOURNAMENT_PHASE_KEYS = ["zones", "knockout", "final"] as const;
export type TournamentPhaseKey = (typeof TOURNAMENT_PHASE_KEYS)[number];

export const TOURNAMENT_PHASE_META: Record<
  TournamentPhaseKey,
  { label: string; description: string }
> = {
  zones: {
    label: "Fase de zonas",
    description: "Grupos de 3 (o 4 si hace falta). Cada pareja juega 2 partidos.",
  },
  knockout: {
    label: "Fase intermedia",
    description:
      "Llave directa entre zonas y final: el perdedor queda fuera. Cada instancia tiene su formato, duración y días.",
  },
  final: {
    label: "Fase final",
    description:
      "Desde la instancia elegida hasta la final. Cada instancia tiene su formato, duración y días.",
  },
};

const phaseConfigSchema = z.object({
  matchFormat: z.enum(MATCH_FORMAT_VALUES),
  matchDurationMin: z
    .number()
    .int()
    .min(30, "Mínimo 30 minutos")
    .max(180, "Máximo 180 minutos"),
  /// Fechas de días de juego asignados a esta fase (YYYY-MM-DD).
  playDates: z.array(z.string().regex(DATE_REGEX, "Fecha inválida")),
});

const finalPhaseConfigSchema = phaseConfigSchema.extend({
  startsAtRound: z.enum(FINAL_PHASE_START_ROUND_VALUES),
});

export const roundConfigMapSchema = z.object({
  ROUND_64: phaseConfigSchema,
  ROUND_32: phaseConfigSchema,
  ROUND_16: phaseConfigSchema,
  QUARTER_FINALS: phaseConfigSchema,
  SEMI_FINALS: phaseConfigSchema,
  FINAL: phaseConfigSchema,
});

export const playDaySchema = z
  .object({
    date: z.string().regex(DATE_REGEX, "Fecha inválida"),
    startTime: z.string().regex(TIME_REGEX, "Hora inválida (HH:mm)"),
    endTime: z.string().regex(TIME_REGEX, "Hora inválida (HH:mm)"),
    overnightExtraSlots: z.number().int().min(-12).max(12),
    enabledSlotIndexes: z.array(z.number().int().min(0)),
    hasSlotSelection: z.boolean(),
  })
  .refine((d) => isValidPlayDayWindow(d.startTime, d.endTime), {
    message:
      "La hora de fin debe ser posterior al inicio (puede ser del día siguiente)",
    path: ["endTime"],
  });

export const categoryPhaseConfigSchema = z.object({
  categoryId: z.string().min(1),
  phases: z.object({
    zones: phaseConfigSchema,
    knockout: phaseConfigSchema,
    final: finalPhaseConfigSchema,
  }),
  /// Formato / duración / días por instancia de llave (compartido entre intermedia y final).
  rounds: roundConfigMapSchema,
  intervalMin: z.number().int().min(0).max(60),
  pairsPerZone: z
    .number()
    .int()
    .min(2, "Mínimo 2 por zona")
    .max(8, "Máximo 8 por zona"),
  /// En zona de 4: 3 = Federación (FAP), 2 = Asociación (APA).
  zone4Advancers: z.union([z.literal(2), z.literal(3)]),
});

export const tournamentConfigSchema = z.object({
  courtCount: z
    .number()
    .int()
    .min(1, "Mínimo 1 cancha")
    .max(32, "Máximo 32 canchas"),
  playDays: z.array(playDaySchema).min(1, "Definí las fechas del torneo en Info"),
  categories: z
    .array(categoryPhaseConfigSchema)
    .min(1, "Agregá al menos una categoría"),
});

export const ZONE4_ADVANCERS_VALUES = [3, 2] as const;
export type Zone4Advancers = (typeof ZONE4_ADVANCERS_VALUES)[number];

export const DEFAULT_ZONE4_ADVANCERS: Zone4Advancers = 3;

export const ZONE4_ADVANCERS_LABELS: Record<Zone4Advancers, string> = {
  3: "Pasan 3 · Federación (FAP)",
  2: "Pasan 2 · Asociación (APA)",
};

export function normalizeZone4Advancers(
  value: number | null | undefined,
): Zone4Advancers {
  return value === 2 ? 2 : 3;
}

export type PhaseConfigValues = z.infer<typeof phaseConfigSchema>;
export type FinalPhaseConfigValues = z.infer<typeof finalPhaseConfigSchema>;
export type RoundConfigMapValues = z.infer<typeof roundConfigMapSchema>;
export type CategoryPhaseConfigValues = z.infer<typeof categoryPhaseConfigSchema>;
export type TournamentConfigValues = z.infer<typeof tournamentConfigSchema>;
export type PlayDayValues = z.infer<typeof playDaySchema>;
