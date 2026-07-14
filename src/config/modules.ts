/// Módulos de la plataforma. Se habilitan por club (feature flags) sin tocar código.
export const MODULES = [
  "turnos",
  "torneos",
  "socios",
  "caja",
  "bar",
  "ranking",
  "clases",
  "videos",
  "notificaciones",
  "pagos",
  "reportes",
  "estadisticas",
  "herramientas",
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  turnos: "Gestión de Turnos",
  torneos: "Torneos",
  socios: "Socios",
  caja: "Caja",
  bar: "Bar",
  ranking: "Ranking",
  clases: "Clases",
  videos: "Videos",
  notificaciones: "Notificaciones",
  pagos: "Pagos",
  reportes: "Reportes",
  estadisticas: "Estadísticas",
  herramientas: "Herramientas",
};

/// Sub-pestañas del módulo Herramientas.
export const HERRAMIENTAS_TABS = [
  { slug: "eco-torneo", label: "Eco-Torneo" },
] as const;

/// Módulos ya implementados / en desarrollo (para navegación).
export const ACTIVE_MODULES: ModuleKey[] = ["turnos", "torneos", "herramientas"];
