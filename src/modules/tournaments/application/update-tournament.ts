import type { UpdateTournamentValues } from "../domain/tournament-schema";
import type { MutationResult, TournamentRepository } from "./tournament-repository";

export async function updateTournament(
  repo: TournamentRepository,
  clubId: string,
  tournamentId: string,
  input: UpdateTournamentValues,
): Promise<MutationResult> {
  return repo.updateTournament(clubId, tournamentId, input);
}
