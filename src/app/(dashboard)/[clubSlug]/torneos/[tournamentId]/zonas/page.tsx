import { redirect } from "next/navigation";

import { getZonasTournamentDetail } from "@/modules/tournaments/application/get-zonas-tournament-detail";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

/// Redirige a la primera categoría (los botones del torneo van directo a cada una).
export default async function TorneoZonasIndexPage({
  params,
}: {
  params: Promise<{ clubSlug: string; tournamentId: string }>;
}) {
  const { clubSlug, tournamentId } = await params;
  const repo = getTournamentRepository();
  const data = await getZonasTournamentDetail(repo, clubSlug, tournamentId);
  const first = data?.tournament.categories[0];
  if (first) {
    redirect(`/${clubSlug}/torneos/${tournamentId}/zonas/${first.id}`);
  }
  redirect(`/${clubSlug}/torneos/${tournamentId}`);
}
