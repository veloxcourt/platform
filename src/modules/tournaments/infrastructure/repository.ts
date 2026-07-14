import type { TournamentRepository } from "../application/tournament-repository";
import { MockTournamentRepository } from "./mock-tournament-repository";
import { PrismaTournamentRepository } from "./prisma-tournament-repository";

let instance: TournamentRepository | null = null;

export function getTournamentRepository(): TournamentRepository {
  if (!instance) {
    instance = process.env.DATABASE_URL
      ? new PrismaTournamentRepository()
      : new MockTournamentRepository();
  }
  return instance;
}
