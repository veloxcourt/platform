import {
  ACTIVE_MODULES,
  MODULES,
  NAV_TAB_IDS,
  applyNavOrder,
  type AdminModuleKey,
  type NavTabId,
} from "@/config/modules";

export type DashboardNavItem = {
  id: NavTabId;
  /** false = módulo "próximamente" (visible pero no clickeable). */
  enabled: boolean;
};

/** Pestañas que el usuario puede ver, en orden por defecto. */
export function visibleNavTabs(
  allowedModules: AdminModuleKey[],
): DashboardNavItem[] {
  const canSeeUpcoming =
    allowedModules.includes("tipos-usuario") ||
    allowedModules.includes("usuarios");

  const items: DashboardNavItem[] = [];

  for (const id of NAV_TAB_IDS) {
    if (id === "jugadores" || id === "catalogo" || id === "menu-precios") {
      if (allowedModules.includes(id)) {
        items.push({ id, enabled: true });
      }
      continue;
    }

    if (id === "control-usuarios") {
      if (
        allowedModules.includes("tipos-usuario") ||
        allowedModules.includes("usuarios")
      ) {
        items.push({ id, enabled: true });
      }
      continue;
    }

    if (id === "herramientas") {
      if (
        allowedModules.includes("eco-torneo") ||
        allowedModules.includes("calendario")
      ) {
        items.push({ id, enabled: true });
      }
      continue;
    }

    // Resto: módulos de MODULES
    if (!(MODULES as readonly string[]).includes(id)) continue;

    const active = (ACTIVE_MODULES as readonly string[]).includes(id);
    const permitted = allowedModules.includes(id as AdminModuleKey);

    if (active && permitted) {
      items.push({ id, enabled: true });
      continue;
    }

    if (!active && canSeeUpcoming) {
      items.push({ id, enabled: false });
    }
  }

  return items;
}

export function orderedNavTabs(
  allowedModules: AdminModuleKey[],
  savedOrder: string[] | null | undefined,
): DashboardNavItem[] {
  const visible = visibleNavTabs(allowedModules);
  const byId = new Map(visible.map((item) => [item.id, item]));
  const orderedIds = applyNavOrder(
    visible.map((item) => item.id),
    savedOrder,
  );
  return orderedIds
    .map((id) => byId.get(id))
    .filter((item): item is DashboardNavItem => Boolean(item));
}
