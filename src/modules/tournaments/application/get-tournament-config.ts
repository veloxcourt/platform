import type { TournamentRepository } from "./tournament-repository";
import type { TournamentConfigData } from "../domain/types";

export async function getTournamentConfig(
  repo: TournamentRepository,
  clubSlug: string,
  tournamentId: string,
): Promise<TournamentConfigData | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const config = await repo.getTournamentConfig(club.id, tournamentId);
  if (!config) return null;

  return { club: { id: club.id, name: club.name, slug: club.slug }, config };
}
