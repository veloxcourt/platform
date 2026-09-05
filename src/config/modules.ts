/** Ids estables de las pestañas principales del dashboard (ordenables). */
export const NAV_TAB_IDS = [
  "jugadores",
  "catalogo",
  "menu-precios",
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
  "control-usuarios",
  "que-mejoro",
] as const;

export type NavTabId = (typeof NAV_TAB_IDS)[number];

export const NAV_TAB_LABELS: Record<NavTabId, string> = {
  jugadores: "Jugadores",
  catalogo: "Catálogo",
  "menu-precios": "Menú de precios",
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
  "control-usuarios": "Control Usuarios",
  "que-mejoro": "Qué mejoro?",
};

export function navTabHref(clubSlug: string, tabId: NavTabId): string {
  switch (tabId) {
    case "catalogo":
      return `/${clubSlug}/catalogo`;
    case "menu-precios":
      return `/${clubSlug}/catalogo/menu`;
    case "control-usuarios":
      return `/${clubSlug}/control-usuarios`;
    default:
      return `/${clubSlug}/${tabId}`;
  }
}

/** Aplica un orden guardado; las pestañas nuevas se insertan tras su vecina por defecto. */
export function applyNavOrder(
  available: NavTabId[],
  saved: string[] | null | undefined,
): NavTabId[] {
  if (!saved?.length) return available;
  const avail = new Set(available);
  const ordered = saved.filter((id): id is NavTabId =>
    avail.has(id as NavTabId),
  );
  const remaining = available.filter((id) => !ordered.includes(id));
  const result = [...ordered];
  for (const id of remaining) {
    const defaultIndex = NAV_TAB_IDS.indexOf(id);
    const predecessor = defaultIndex > 0 ? NAV_TAB_IDS[defaultIndex - 1] : null;
    const predPos = predecessor ? result.indexOf(predecessor) : -1;
    if (predPos >= 0) {
      result.splice(predPos + 1, 0, id);
    } else {
      result.push(id);
    }
  }
  return result;
}

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
  { slug: "eco-torneo", label: "Eco-Torneo", privilege: "eco-torneo" },
  { slug: "calendario", label: "Calendario", privilege: "calendario" },
] as const;

export function firstHerramientasSlug(
  allowedModules: readonly string[],
): (typeof HERRAMIENTAS_TABS)[number]["slug"] | null {
  const tab = HERRAMIENTAS_TABS.find((item) =>
    allowedModules.includes(item.privilege),
  );
  return tab?.slug ?? null;
}

/// Sub-pestañas del módulo Control Usuarios.
export const CONTROL_USUARIOS_TABS = [
  { slug: "tipo-usuario", label: "Tipo Usuario", privilege: "tipos-usuario" },
  { slug: "usuarios", label: "Usuarios", privilege: "usuarios" },
] as const;

/// Sub-pestañas del módulo Torneos (mismo privilegio; listado queda en /torneos).
/// Soporte vive dentro de Configuración del torneo (chequeo durante el armado).
export const TORNEOS_TABS = [
  { slug: "listado", label: "Listado" },
] as const;

export function firstControlUsuariosSlug(
  allowedModules: readonly string[],
): (typeof CONTROL_USUARIOS_TABS)[number]["slug"] | null {
  const tab = CONTROL_USUARIOS_TABS.find((item) =>
    allowedModules.includes(item.privilege),
  );
  return tab?.slug ?? null;
}

/// Módulos ya implementados / en desarrollo (para navegación).
export const ACTIVE_MODULES: ModuleKey[] = ["turnos", "torneos", "herramientas"];

/// Privilegios configurables en tipos de usuario (evolucionarán con el uso).
export const ADMIN_MODULES = [
  "jugadores",
  "catalogo",
  "menu-precios",
  "turnos",
  "torneos",
  "eco-torneo",
  "calendario",
  "tipos-usuario",
  "usuarios",
  "que-mejoro",
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULES)[number];

export const ADMIN_MODULE_LABELS: Record<AdminModuleKey, string> = {
  jugadores: "Jugadores",
  catalogo: "Catálogo · Edición",
  "menu-precios": "Catálogo · Menú de precios",
  turnos: "Gestión de Turnos",
  torneos: "Torneos",
  "eco-torneo": "Eco-Torneo",
  calendario: "Calendario",
  "tipos-usuario": "Tipo Usuario",
  usuarios: "Usuarios",
  "que-mejoro": "Qué mejoro?",
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
    options: [
      { key: "eco-torneo", label: "Eco-Torneo" },
      { key: "calendario", label: "Calendario" },
    ],
  },
  {
    id: "control-usuarios",
    label: "Control Usuarios",
    options: [
      { key: "tipos-usuario", label: "Tipo Usuario" },
      { key: "usuarios", label: "Usuarios" },
    ],
  },
  {
    id: "que-mejoro",
    label: "Qué mejoro?",
    options: [{ key: "que-mejoro", label: "Acceso" }],
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
