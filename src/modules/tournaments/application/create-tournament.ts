import type { CreateTournamentValues } from "../domain/tournament-schema";
import type { TournamentRepository } from "./tournament-repository";

export async function createTournament(
  repo: TournamentRepository,
  clubId: string,
  input: CreateTournamentValues,
): Promise<{ id: string }> {
  return repo.createTournament(clubId, input);
}
