import { $Enums, type AdminModule } from "@prisma/client";

import {
  ADMIN_MODULES,
  firstControlUsuariosSlug,
  firstHerramientasSlug,
  type AdminModuleKey,
} from "@/config/modules";

export const MODULE_TO_DATABASE: Record<AdminModuleKey, AdminModule> = {
  jugadores: "PLAYERS",
  catalogo: "CATALOG",
  "menu-precios": "PRICE_MENU",
  turnos: "BOOKINGS",
  torneos: "TOURNAMENTS",
  "eco-torneo": "TOOLS_ECO_TORNEO",
  calendario: "TOOLS_CALENDARIO",
  "tipos-usuario": "USER_TYPES",
  usuarios: "USERS",
  "que-mejoro": "QUE_MEJORO",
};

const DATABASE_TO_MODULE: Partial<Record<AdminModule, AdminModuleKey>> = {
  PLAYERS: "jugadores",
  CATALOG: "catalogo",
  PRICE_MENU: "menu-precios",
  BOOKINGS: "turnos",
  TOURNAMENTS: "torneos",
  TOOLS_ECO_TORNEO: "eco-torneo",
  TOOLS_CALENDARIO: "calendario",
  USER_TYPES: "tipos-usuario",
  USERS: "usuarios",
  QUE_MEJORO: "que-mejoro",
};

export function toDatabaseModules(modules: AdminModuleKey[]): AdminModule[] {
  const known = new Set<string>(Object.values($Enums.AdminModule));
  const result: AdminModule[] = [];

  for (const module of modules) {
    const value = MODULE_TO_DATABASE[module];
    if (known.has(value)) {
      result.push(value);
      continue;
    }
    // Cliente Prisma cacheado (webpack/HMR) aún no conoce los enums nuevos.
    if (
      (module === "eco-torneo" || module === "calendario") &&
      known.has("TOOLS")
    ) {
      result.push("TOOLS");
    }
  }

  return [...new Set(result)];
}

export function toModuleKeys(modules: AdminModule[]): AdminModuleKey[] {
  const keys = new Set<AdminModuleKey>();
  for (const module of modules) {
    if (module === "TOOLS") {
      keys.add("eco-torneo");
      keys.add("calendario");
      continue;
    }
    const key = DATABASE_TO_MODULE[module];
    if (key) keys.add(key);
  }
  return ADMIN_MODULES.filter((key) => keys.has(key));
}

const NESTED_PRIVILEGES = new Set<AdminModuleKey>([
  "tipos-usuario",
  "usuarios",
  "menu-precios",
  "eco-torneo",
  "calendario",
]);

/** Primera solapa navegable tras login. */
export function firstDestinationModule(
  privileges: AdminModule[],
  role?: string,
): string {
  if (role === "OWNER") return "turnos";
  const keys = toModuleKeys(privileges);
  const operational = keys.find((key) => !NESTED_PRIVILEGES.has(key));
  if (operational) return operational;
  if (keys.includes("menu-precios")) return "catalogo/menu";
  const herramientasSlug = firstHerramientasSlug(keys);
  if (herramientasSlug) return `herramientas/${herramientasSlug}`;
  const controlSlug = firstControlUsuariosSlug(keys);
  if (controlSlug) return `control-usuarios/${controlSlug}`;
  return "turnos";
}
