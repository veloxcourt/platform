import type { TournamentRepository } from "./tournament-repository";
import type { ZonasTournamentDetailData } from "../domain/types";

export async function getZonasTournamentDetail(
  repo: TournamentRepository,
  clubSlug: string,
  tournamentId: string,
): Promise<ZonasTournamentDetailData | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const [tournament, levels] = await Promise.all([
    repo.getZonasTournamentDetail(club.id, tournamentId),
    repo.getClubLevels(club.id),
  ]);
  if (!tournament) return null;

  return { club, tournament, levels };
}
