import { redirect } from "next/navigation";

import {
  parseTournamentMode,
  withTournamentMode,
} from "@/lib/tournament-mode";
import { getZonasTournamentDetail } from "@/modules/tournaments/application/get-zonas-tournament-detail";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

/// Redirige a la primera categoría (los botones del torneo van directo a cada una).
export default async function TorneoZonasIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string; tournamentId: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { clubSlug, tournamentId } = await params;
  const { modo } = await searchParams;
  const mode = parseTournamentMode(modo);
  const repo = getTournamentRepository();
  const data = await getZonasTournamentDetail(repo, clubSlug, tournamentId);
  const first = data?.tournament.categories[0];
  if (first) {
    redirect(
      withTournamentMode(
        `/${clubSlug}/torneos/${tournamentId}/zonas/${first.id}`,
        mode,
      ),
    );
  }
  redirect(withTournamentMode(`/${clubSlug}/torneos/${tournamentId}`, mode));
}
