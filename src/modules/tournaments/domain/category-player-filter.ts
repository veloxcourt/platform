import type { Gender } from "@/modules/bookings/domain/new-player-schema";
import type { PlayerRef } from "@/modules/bookings/domain/types";
import type { TournamentCategoryGender } from "./category-schema";

export function parseCategoryGenderFromName(
  categoryName: string,
): TournamentCategoryGender | null {
  const name = categoryName.trim();
  if (name.startsWith("Femenina Suma")) return "FEMENINA_SUMA";
  if (name.startsWith("Masculina Suma")) return "MASCULINA_SUMA";
  if (name.startsWith("Mixta Suma")) return "MIXTA_SUMA";
  if (name.startsWith("Femenina")) return "FEMENINA";
  if (name.startsWith("Masculina")) return "MASCULINA";
  if (name.startsWith("Mixta")) return "MIXTA";
  return null;
}

function requiredPlayerGender(
  categoryGender: TournamentCategoryGender,
): Gender | null {
  if (
    categoryGender === "FEMENINA" ||
    categoryGender === "FEMENINA_SUMA"
  ) {
    return "FEMALE";
  }
  if (
    categoryGender === "MASCULINA" ||
    categoryGender === "MASCULINA_SUMA"
  ) {
    return "MALE";
  }
  return null;
}

export function isPlayerEligibleForCategory(
  player: PlayerRef,
  categoryGender: TournamentCategoryGender,
): boolean {
  const required = requiredPlayerGender(categoryGender);
  if (!required) return true;
  return player.gender === required;
}

export function filterPlayersForCategory(
  players: PlayerRef[],
  categoryName: string,
  alwaysIncludeIds: string[] = [],
): PlayerRef[] {
  const categoryGender = parseCategoryGenderFromName(categoryName);
  if (!categoryGender) return players;

  const keep = new Set(alwaysIncludeIds.filter(Boolean));
  return players.filter(
    (player) =>
      keep.has(player.id) ||
      isPlayerEligibleForCategory(player, categoryGender),
  );
}

/// IDs de jugadores ya inscriptos en el torneo (parejas no canceladas).
export function collectInscribedPlayerIds(
  pairs: Array<{
    id: string;
    status: string;
    player1: { id: string };
    player2: { id: string } | null;
  }>,
  excludePairId?: string,
): Set<string> {
  const ids = new Set<string>();
  for (const pair of pairs) {
    if (pair.status === "CANCELLED") continue;
    if (excludePairId && pair.id === excludePairId) continue;
    ids.add(pair.player1.id);
    if (pair.player2?.id) ids.add(pair.player2.id);
  }
  return ids;
}

/// Jugadores elegibles: género de categoría + no inscriptos (salvo IDs a conservar).
export function filterAvailablePlayersForInscription(
  players: PlayerRef[],
  categoryName: string,
  inscribedPlayerIds: Set<string>,
  alwaysIncludeIds: string[] = [],
): PlayerRef[] {
  const keep = new Set(alwaysIncludeIds.filter(Boolean));
  return filterPlayersForCategory(players, categoryName, alwaysIncludeIds).filter(
    (player) => keep.has(player.id) || !inscribedPlayerIds.has(player.id),
  );
}
