import type { TournamentRepository } from "./tournament-repository";
import type { TournamentCategoriesData } from "../domain/types";

export async function getTournamentCategories(
  repo: TournamentRepository,
  clubSlug: string,
  tournamentId: string,
): Promise<TournamentCategoriesData | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const [categories, tournament] = await Promise.all([
    repo.listTournamentCategories(club.id, tournamentId),
    repo.getZonasTournamentDetail(club.id, tournamentId),
  ]);
  if (!categories || !tournament) return null;

  const levels = await repo.getClubLevels(club.id);

  return {
    club: { id: club.id, name: club.name, slug: club.slug },
    tournament: {
      id: tournament.id,
      name: tournament.name,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
    },
    categories,
    levels,
  };
}
