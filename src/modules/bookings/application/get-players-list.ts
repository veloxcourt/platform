import type { BookingRepository } from "./booking-repository";
import type { ClubInfo, PlayerListItem } from "../domain/types";

export interface PlayersListData {
  club: ClubInfo;
  players: PlayerListItem[];
  categories: string[];
}

/// Caso de uso: listado de jugadores del club con su saldo de cuenta.
export async function getPlayersList(
  repo: BookingRepository,
  clubSlug: string,
): Promise<PlayersListData | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const [players, categories] = await Promise.all([
    repo.listPlayers(club.id),
    repo.getClubCategories(club.id),
  ]);

  return { club, players, categories };
}
