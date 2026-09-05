import type { Gender } from "@/modules/bookings/domain/new-player-schema";
import type { PlayerRef } from "@/modules/bookings/domain/types";
import type { TournamentCategoryGender } from "./category-schema";

export function parseCategoryGenderFromName(
  categoryName: string,
): TournamentCategoryGender | null {
  const name = categoryName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const isSuma = /\bsuma\b/.test(name);
  const isFemenina = /\bfemenina\b|\bdamas\b/.test(name);
  const isMasculina = /\bmasculina\b|\bcaballeros\b/.test(name);
  const isMixta = /\bmixta\b|\bmixto\b/.test(name);

  if (isFemenina && !isMasculina) {
    return isSuma ? "FEMENINA_SUMA" : "FEMENINA";
  }
  if (isMasculina && !isFemenina) {
    return isSuma ? "MASCULINA_SUMA" : "MASCULINA";
  }
  if (isMixta) {
    return isSuma ? "MIXTA_SUMA" : "MIXTA";
  }
  return null;
}

export function requiredPlayerGender(
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

export function requiredGenderFromCategoryName(
  categoryName: string,
): Gender | null {
  const categoryGender = parseCategoryGenderFromName(categoryName);
  if (!categoryGender) return null;
  return requiredPlayerGender(categoryGender);
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
