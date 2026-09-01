export type TournamentMode = "ver" | "editar";

export function parseTournamentMode(value?: string | null): TournamentMode {
  return value === "ver" ? "ver" : "editar";
}

export function withTournamentMode(href: string, mode: TournamentMode): string {
  const qIndex = href.indexOf("?");
  const path = qIndex === -1 ? href : href.slice(0, qIndex);
  const query = qIndex === -1 ? "" : href.slice(qIndex + 1);
  const params = new URLSearchParams(query);
  params.set("modo", mode);
  return `${path}?${params.toString()}`;
}
