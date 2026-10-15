export const TURNOS_ABBREV_NAMES_COOKIE = "turnos-nombres-abreviados";

/// Sin cookie, los nombres se muestran completos.
export function resolveAbbreviateNames(saved: string | undefined): boolean {
  return saved === "1";
}

export function persistAbbreviateNames(on: boolean) {
  const value = on ? "1" : "0";
  document.cookie = `${TURNOS_ABBREV_NAMES_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/// "Marcelo Guajardo" → "M. Guajardo". El resto después del primer nombre es el apellido.
export function abbreviateResponsibleName(name: string): string {
  const trimmed = name.trim();
  const match = trimmed.match(/^(\S+)\s+(.+)$/);
  if (!match) return trimmed;
  const initial = match[1].charAt(0).toLocaleUpperCase("es-AR");
  return `${initial}. ${match[2]}`;
}

export function formatResponsibleName(name: string, abbreviate: boolean): string {
  return abbreviate ? abbreviateResponsibleName(name) : name;
}
