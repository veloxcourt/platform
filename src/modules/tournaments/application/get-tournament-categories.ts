import type { TournamentRepository } from "./tournament-repository";
import type { TournamentCategoriesData } from "../domain/types";

export async function getTournamentCategories(
  repo: TournamentRepository,
  clubSlug: string,
  tournamentId: string,
): Promise<TournamentCategoriesData | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const [categories, tournament, catalogCategories] = await Promise.all([
    repo.listTournamentCategories(club.id, tournamentId),
    repo.getZonasTournamentDetail(club.id, tournamentId),
    repo.listCatalogCategories(club.id),
  ]);
  if (!categories || !tournament) return null;

  return {
    club: { id: club.id, name: club.name, slug: club.slug },
    tournament: {
      id: tournament.id,
      name: tournament.name,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
    },
    categories,
    catalogCategories,
  };
}
