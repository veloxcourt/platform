"use server";

import { registerPublicPair } from "@/modules/tournaments/application/register-public-pair";
import {
  searchPublicClubPlayers,
  type PublicClubPlayerMatch,
} from "@/modules/tournaments/application/search-public-club-players";

export type PublicInscriptionState = { ok?: true; error?: string };

function parseSlotsJson(raw: string) {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function submitPublicInscriptionAction(
  _previous: PublicInscriptionState,
  formData: FormData,
): Promise<PublicInscriptionState> {
  const result = await registerPublicPair({
    publicSlug: String(formData.get("publicSlug") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    player1: {
      firstName: String(formData.get("player1FirstName") ?? ""),
      lastName: String(formData.get("player1LastName") ?? ""),
      phone: String(formData.get("player1Phone") ?? ""),
      gender: String(formData.get("player1Gender") ?? ""),
    },
    player2: {
      firstName: String(formData.get("player2FirstName") ?? ""),
      lastName: String(formData.get("player2LastName") ?? ""),
      phone: String(formData.get("player2Phone") ?? ""),
      gender: String(formData.get("player2Gender") ?? ""),
    },
    zonesDayPreference: String(formData.get("zonesDayPreference") ?? "ANY"),
    slots: parseSlotsJson(String(formData.get("slotsJson") ?? "[]")),
  });
  return result.ok ? { ok: true } : { error: result.error };
}

export async function searchPublicClubPlayersAction(
  publicSlug: string,
  query: string,
  excludeIds: string[] = [],
  categoryName?: string,
): Promise<PublicClubPlayerMatch[]> {
  return searchPublicClubPlayers(publicSlug, query, excludeIds, categoryName);
}
