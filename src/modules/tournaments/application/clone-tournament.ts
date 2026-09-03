import type { TournamentRepository } from "./tournament-repository";

export async function cloneTournament(
  repo: TournamentRepository,
  clubId: string,
  tournamentId: string,
  includePairs: boolean,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  return repo.cloneTournament(clubId, tournamentId, { includePairs });
}
