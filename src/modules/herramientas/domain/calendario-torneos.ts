/// Tipos del planificador de calendario de torneos.

export type CalendarClub = {
  id: string;
  name: string;
  /** Color CSS hex, ej. #2563eb */
  color: string;
};

export type CatalogCategory = {
  id: string;
  name: string;
  /** Abreviación corta, ej. "M6" */
  abbreviation: string;
  /** Color CSS hex */
  color: string;
};

export type PlannedTournament = {
  id: string;
  name: string;
  clubId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  categoryIds: string[];
};

export const DEFAULT_LIBRE_FILL = "#fde68a";
export const DEFAULT_LIBRE_BORDER = "#d97706";

export type CalendarPlannerSettings = {
  libreFill: string;
  libreBorder: string;
};

/** Sitio para buscar torneos de la zona y completar el calendario. */
export type CalendarSearchLink = {
  id: string;
  name: string;
  url: string;
  description: string;
};

export const DEFAULT_TOURNAMENT_SEARCH_LINKS: CalendarSearchLink[] = [
  {
    id: "builtin-fap-calendario",
    name: "FAP · Calendario",
    url: "https://www.torneosfapoficial.com.ar/institucional_calendario.php",
    description: "Calendario FAP: qué categorías se juegan y en qué sedes.",
  },
  {
    id: "builtin-fap-eventos",
    name: "FAP · Eventos",
    url: "https://www.torneosfapoficial.com.ar/eventos.php",
    description: "Listado FAP para no repetir categoría el mismo fin de semana.",
  },
  {
    id: "builtin-apa-eventos",
    name: "APA · Eventos",
    url: "https://torneosapa.com.ar/eventos.php",
    description: "Torneos APA por circuito, sede y categoría.",
  },
  {
    id: "builtin-apa-calendario",
    name: "APA · Calendario",
    url: "https://torneosapa.com.ar/institucional_calendario.php",
    description: "Vista de calendario APA para cruzar fechas de la zona.",
  },
  {
    id: "builtin-apt",
    name: "Argentina Padel Tour",
    url: "https://argentinapadeltour.com/",
    description: "Circuito profesional: fechas y categorías ya cubiertas.",
  },
];

export type CalendarPlannerState = {
  clubs: CalendarClub[];
  categories: CatalogCategory[];
  tournaments: PlannedTournament[];
  settings: CalendarPlannerSettings;
  searchLinks: CalendarSearchLink[];
};

export const CALENDAR_PALETTE = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
] as const;
