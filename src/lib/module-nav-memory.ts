import type { NavTabId } from "@/config/modules";
import { navTabHref } from "@/config/modules";

const STORAGE_PREFIX = "velox:last-module-path:";

function storageKey(clubSlug: string, tabId: NavTabId): string {
  return `${STORAGE_PREFIX}${clubSlug}:${tabId}`;
}

/** Guarda la última URL visitada dentro de un módulo del dashboard. */
export function rememberModulePath(
  clubSlug: string,
  tabId: NavTabId,
  pathWithSearch: string,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(clubSlug, tabId), pathWithSearch);
  } catch {
    // sessionStorage puede fallar en modo privado / cuota.
  }
}

/** Devuelve la última URL del módulo, si sigue siendo de ese club/módulo. */
export function getRememberedModulePath(
  clubSlug: string,
  tabId: NavTabId,
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(storageKey(clubSlug, tabId));
    if (!saved) return null;
    const base = navTabHref(clubSlug, tabId);
    if (saved === base || saved.startsWith(`${base}?`) || saved.startsWith(`${base}/`)) {
      return saved;
    }
    return null;
  } catch {
    return null;
  }
}

/** Detecta qué pestaña de nav corresponde a un pathname. */
export function navTabIdFromPathname(
  clubSlug: string,
  pathname: string,
  tabIds: readonly NavTabId[],
): NavTabId | null {
  // Preferir match más específico (más largo).
  let best: { id: NavTabId; len: number } | null = null;
  for (const id of tabIds) {
    const base = navTabHref(clubSlug, id);
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      if (!best || base.length > best.len) {
        best = { id, len: base.length };
      }
    }
  }
  return best?.id ?? null;
}
