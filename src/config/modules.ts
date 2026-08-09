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

/// Privilegios configurables en tipos de usuario (evolucionarán con el uso).
export const ADMIN_MODULES = [
  "jugadores",
  "catalogo",
  "menu-precios",
  "turnos",
  "torneos",
  "herramientas",
  "tipos-usuario",
  "usuarios",
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULES)[number];

export const ADMIN_MODULE_LABELS: Record<AdminModuleKey, string> = {
  jugadores: "Jugadores",
  catalogo: "Catálogo · Edición",
  "menu-precios": "Catálogo · Menú de precios",
  turnos: "Gestión de Turnos",
  torneos: "Torneos",
  herramientas: "Herramientas",
  "tipos-usuario": "Tipos de usuario",
  usuarios: "Usuarios",
};

export const ALL_PRIVILEGES: AdminModuleKey[] = [...ADMIN_MODULES];

export type PrivilegeOption = {
  key: AdminModuleKey;
  label: string;
};

/** Cada solapa = un grupo de privilegios (se irá ampliando). */
export type PrivilegeGroup = {
  id: string;
  label: string;
  options: PrivilegeOption[];
};

export const PRIVILEGE_GROUPS: PrivilegeGroup[] = [
  {
    id: "jugadores",
    label: "Jugadores",
    options: [{ key: "jugadores", label: "Acceso" }],
  },
  {
    id: "catalogo",
    label: "Catálogo",
    options: [
      { key: "catalogo", label: "Edición" },
      { key: "menu-precios", label: "Menú de precios" },
    ],
  },
  {
    id: "turnos",
    label: "Gestión de Turnos",
    options: [{ key: "turnos", label: "Acceso" }],
  },
  {
    id: "torneos",
    label: "Torneos",
    options: [{ key: "torneos", label: "Acceso" }],
  },
  {
    id: "herramientas",
    label: "Herramientas",
    options: [{ key: "herramientas", label: "Acceso" }],
  },
  {
    id: "tipos-usuario",
    label: "Tipos de usuario",
    options: [{ key: "tipos-usuario", label: "Acceso" }],
  },
  {
    id: "usuarios",
    label: "Usuarios",
    options: [{ key: "usuarios", label: "Acceso" }],
  },
];

/** Edición de catálogo implica poder ver el menú de precios. */
export function applyPrivilegeToggle(
  current: AdminModuleKey[],
  privilege: AdminModuleKey,
  checked: boolean,
): AdminModuleKey[] {
  const next = new Set(current);

  if (checked) {
    next.add(privilege);
    if (privilege === "catalogo") next.add("menu-precios");
    return [...ADMIN_MODULES].filter((key) => next.has(key));
  }

  // Con Edición activa, Menú de precios no se puede quitar.
  if (privilege === "menu-precios" && next.has("catalogo")) {
    return [...ADMIN_MODULES].filter((key) => next.has(key));
  }

  next.delete(privilege);
  return [...ADMIN_MODULES].filter((key) => next.has(key));
}
