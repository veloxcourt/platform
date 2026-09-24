import { z } from "zod";

export const PLAYER_EVENT_TYPES = ["CATEGORY_CHANGE", "TOURNAMENT"] as const;

export type PlayerEventType = (typeof PLAYER_EVENT_TYPES)[number];

export const PLAYER_EVENT_TYPE_LABELS: Record<PlayerEventType, string> = {
  CATEGORY_CHANGE: "Cambio de categoría",
  TOURNAMENT: "Participación en torneo",
};

export const TOURNAMENT_ROUNDS = [
  "Zonas",
  "32avos",
  "16avos",
  "Octavos",
  "Cuartos",
  "Semifinal",
  "Final",
  "Campeón",
] as const;

export type TournamentRound = (typeof TOURNAMENT_ROUNDS)[number];

export function tournamentRoundRank(round: TournamentRound): number {
  return TOURNAMENT_ROUNDS.indexOf(round);
}

export function isTournamentRound(value: unknown): value is TournamentRound {
  return (
    typeof value === "string" &&
    (TOURNAMENT_ROUNDS as readonly string[]).includes(value)
  );
}

const occurredOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha del suceso");

const noteSchema = z
  .string()
  .trim()
  .max(500, "La observación admite hasta 500 caracteres")
  .optional()
  .or(z.literal(""));

const categoryChangeDataSchema = z.object({
  previousCategory: z
    .string()
    .trim()
    .max(40, "La categoría anterior es demasiado larga")
    .optional()
    .or(z.literal("")),
  newCategory: z
    .string()
    .trim()
    .min(1, "Elegí la categoría nueva")
    .max(40, "La categoría nueva es demasiado larga"),
  linkedTournamentKey: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("")),
});

const tournamentDataSchema = z.object({
  tournamentName: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre del torneo")
    .max(120, "El nombre del torneo es demasiado largo"),
  category: z
    .string()
    .trim()
    .min(1, "Ingresá la categoría en la que jugó")
    .max(40, "La categoría es demasiado larga"),
  roundReached: z.enum(TOURNAMENT_ROUNDS, {
    message: "Elegí la instancia alcanzada",
  }),
  partnerName: z
    .string()
    .trim()
    .min(1, "Ingresá el compañero")
    .max(80, "El nombre del compañero es demasiado largo"),
});

export const createPlayerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CATEGORY_CHANGE"),
    occurredOn: occurredOnSchema,
    note: noteSchema,
    data: categoryChangeDataSchema,
  }),
  z.object({
    type: z.literal("TOURNAMENT"),
    occurredOn: occurredOnSchema,
    note: noteSchema,
    data: tournamentDataSchema,
  }),
]);

export type CreatePlayerEventInput = z.infer<typeof createPlayerEventSchema>;

/// Torneo que originó el cambio. El nombre queda guardado aunque después se borre el torneo.
export type LinkedTournament = {
  tournamentId: string | null;
  eventId: string | null;
  name: string;
};

/// Opción del formulario: un torneo del club o una participación ya cargada.
export type PlayedTournamentOption = {
  key: string;
  name: string;
  date: string;
};

/// Inscripción real del jugador en un torneo del club. Sirve para completar el formulario.
export type PlayerInscriptionOption = {
  key: string;
  name: string;
  date: string;
  categoryName: string;
  partnerName: string | null;
};

export type CategoryChangeData = {
  previousCategory: string | null;
  newCategory: string;
  linkedTournament: LinkedTournament | null;
};

export type TournamentParticipationData = {
  tournamentName: string;
  category: string;
  roundReached: TournamentRound;
  partnerName: string;
};

type PlayerEventBase = {
  id: string;
  occurredOn: string;
  note: string | null;
  createdAt: string;
  createdByName: string;
};

export type PlayerEventItem =
  | (PlayerEventBase & {
      type: "CATEGORY_CHANGE";
      data: CategoryChangeData;
    })
  | (PlayerEventBase & {
      type: "TOURNAMENT";
      data: TournamentParticipationData;
    });

export function playerEventSummary(event: PlayerEventItem): string {
  if (event.type === "CATEGORY_CHANGE") {
    const from = event.data.previousCategory || "Sin categoría";
    const change = `${from} → ${event.data.newCategory}`;
    const tournament = event.data.linkedTournament?.name;
    return tournament ? `${change}, luego de ${tournament}` : change;
  }
  return `${event.data.tournamentName} · ${event.data.category} · ${event.data.roundReached} · con ${event.data.partnerName}`;
}

/// Fecha de calendario `YYYY-MM-DD` a medianoche UTC, sin corrimiento de huso.
export function parseEventDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}
