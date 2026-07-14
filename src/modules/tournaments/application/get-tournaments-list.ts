import type { TournamentRepository } from "./tournament-repository";
import type { TournamentsListData } from "../domain/types";

export async function getTournamentsList(
  repo: TournamentRepository,
  clubSlug: string,
): Promise<TournamentsListData | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const tournaments = await repo.listTournaments(club.id);
  return { club, tournaments };
}
