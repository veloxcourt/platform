import type { MutationResult, TournamentRepository } from "./tournament-repository";

export async function deleteTournament(
  repo: TournamentRepository,
  clubId: string,
  tournamentId: string,
): Promise<MutationResult> {
  return repo.deleteTournament(clubId, tournamentId);
}
