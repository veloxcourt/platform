import type { AdminModule } from "@prisma/client";

import type { AdminModuleKey } from "@/config/modules";

export const MODULE_TO_DATABASE: Record<AdminModuleKey, AdminModule> = {
  jugadores: "PLAYERS",
  catalogo: "CATALOG",
  "menu-precios": "PRICE_MENU",
  turnos: "BOOKINGS",
  torneos: "TOURNAMENTS",
  herramientas: "TOOLS",
  "tipos-usuario": "USER_TYPES",
  usuarios: "USERS",
};

export const DATABASE_TO_MODULE: Record<AdminModule, AdminModuleKey> = {
  PLAYERS: "jugadores",
  CATALOG: "catalogo",
  PRICE_MENU: "menu-precios",
  BOOKINGS: "turnos",
  TOURNAMENTS: "torneos",
  TOOLS: "herramientas",
  USER_TYPES: "tipos-usuario",
  USERS: "usuarios",
};

export function toDatabaseModules(modules: AdminModuleKey[]): AdminModule[] {
  return modules.map((module) => MODULE_TO_DATABASE[module]);
}

export function toModuleKeys(modules: AdminModule[]): AdminModuleKey[] {
  return modules.map((module) => DATABASE_TO_MODULE[module]);
}

/** Primera solapa navegable tras login. */
export function firstDestinationModule(
  privileges: AdminModule[],
  role?: string,
): string {
  if (role === "OWNER") return "turnos";
  const keys = toModuleKeys(privileges);
  const operational = keys.find(
    (key) =>
      key !== "tipos-usuario" &&
      key !== "usuarios" &&
      key !== "menu-precios",
  );
  if (operational) return operational;
  if (keys.includes("menu-precios")) return "catalogo/menu";
  if (keys.includes("usuarios")) return "administradores";
  if (keys.includes("tipos-usuario")) return "tipos-usuario";
  return "turnos";
}
