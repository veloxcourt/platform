/// Genera un slug público único a partir del nombre del torneo.
export function buildTournamentPublicSlug(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `torneo-${suffix}`;
}
