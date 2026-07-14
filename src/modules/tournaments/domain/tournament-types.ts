/// Catálogo de formatos de torneo disponibles en VeloxCourt.
export const TOURNAMENT_TYPES = [
  "AMERICANO",
  "ZONAS",
  "ELIMINACION_DIRECTA",
  "PAREJAS_SORTEADAS",
  "MIXTO",
  "RELAMPAGO",
] as const;

export type TournamentType = (typeof TOURNAMENT_TYPES)[number];

export interface TournamentTypeMeta {
  id: TournamentType;
  label: string;
  description: string;
  registrationHint: string;
}

export const TOURNAMENT_TYPE_CATALOG: TournamentTypeMeta[] = [
  {
    id: "AMERICANO",
    label: "Americano",
    description: "Rotación de parejas y partidos cortos. Ranking por puntos.",
    registrationHint: "Inscripción individual",
  },
  {
    id: "ZONAS",
    label: "Por zonas",
    description:
      "Zonas round-robin, luego fase intermedia (pierde y sale) y fase final.",
    registrationHint: "Parejas fijas",
  },
  {
    id: "ELIMINACION_DIRECTA",
    label: "Eliminación directa",
    description: "Llave desde el primer partido hasta la final.",
    registrationHint: "Parejas fijas",
  },
  {
    id: "PAREJAS_SORTEADAS",
    label: "Parejas sorteadas",
    description: "Jugadores se inscriben solos; el club arma las parejas.",
    registrationHint: "Inscripción individual",
  },
  {
    id: "MIXTO",
    label: "Mixto",
    description: "Parejas hombre + mujer en el mismo torneo.",
    registrationHint: "Parejas fijas",
  },
  {
    id: "RELAMPAGO",
    label: "Relámpago",
    description: "Mismo día, formato express y duración acotada.",
    registrationHint: "Individual o parejas",
  },
];

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> =
  Object.fromEntries(
    TOURNAMENT_TYPE_CATALOG.map((t) => [t.id, t.label]),
  ) as Record<TournamentType, string>;

export function getTournamentTypeMeta(
  type: TournamentType,
): TournamentTypeMeta {
  return (
    TOURNAMENT_TYPE_CATALOG.find((t) => t.id === type) ??
    TOURNAMENT_TYPE_CATALOG[0]
  );
}
