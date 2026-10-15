export const TURNOS_VIEW_COOKIE = "turnos-view";

export type TurnosView = "dia" | "semana";

/// La URL manda. Si no hay vista en la dirección, se usa la última elegida.
/// Sin ninguna de las dos, la agenda abre en semana.
export function resolveTurnosView(
  query: string | undefined,
  saved: string | undefined,
): TurnosView {
  if (query === "dia" || query === "semana") return query;
  if (saved === "dia" || saved === "semana") return saved;
  return "semana";
}

export function persistTurnosView(view: TurnosView) {
  document.cookie = `${TURNOS_VIEW_COOKIE}=${view}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
