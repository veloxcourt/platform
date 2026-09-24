"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import {
  findPublicPairByManageToken,
  type PublicManagedPair,
} from "@/modules/tournaments/application/find-public-pair";
import { registerPublicPair, updatePublicPair } from "@/modules/tournaments/application/register-public-pair";
import { requestPairCancellation } from "@/modules/tournaments/application/request-pair-cancellation";
import {
  searchPublicClubPlayers,
  type PublicClubPlayerMatch,
} from "@/modules/tournaments/application/search-public-club-players";
import {
  parseZonesDayPreference,
  type ZonesDayPreference,
} from "@/modules/tournaments/domain/zones-day-preference";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

export type PublicInscriptionState = {
  ok?: true;
  updated?: true;
  managePath?: string;
  error?: string;
};

function parseSlotsJson(raw: string) {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function inscriptionPayload(formData: FormData) {
  const loggedInUserId = String(formData.get("loggedInUserId") ?? "").trim();
  return {
    publicSlug: String(formData.get("publicSlug") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    loggedInUserId: loggedInUserId || undefined,
    manageToken: String(formData.get("manageToken") ?? "").trim() || undefined,
    player1: {
      firstName: String(formData.get("player1FirstName") ?? ""),
      lastName: String(formData.get("player1LastName") ?? ""),
      phone: String(formData.get("player1Phone") ?? ""),
      gender: String(formData.get("player1Gender") ?? ""),
      city: String(formData.get("player1City") ?? ""),
    },
    player2: {
      firstName: String(formData.get("player2FirstName") ?? ""),
      lastName: String(formData.get("player2LastName") ?? ""),
      phone: String(formData.get("player2Phone") ?? ""),
      gender: String(formData.get("player2Gender") ?? ""),
      city: String(formData.get("player2City") ?? ""),
    },
    zonesDayPreference: String(formData.get("zonesDayPreference") ?? "ANY"),
    slots: parseSlotsJson(String(formData.get("slotsJson") ?? "[]")),
  };
}

export async function submitPublicInscriptionAction(
  _previous: PublicInscriptionState,
  formData: FormData,
): Promise<PublicInscriptionState> {
  const payload = inscriptionPayload(formData);
  if (payload.manageToken) {
    const result = await updatePublicPair(payload);
    return result.ok ? { ok: true, updated: true } : { error: result.error };
  }
  const result = await registerPublicPair(payload);
  return result.ok
    ? { ok: true, managePath: result.managePath }
    : { error: result.error };
}

export async function searchPublicClubPlayersAction(
  publicSlug: string,
  query: string,
  excludeIds: string[] = [],
  categoryName?: string,
): Promise<PublicClubPlayerMatch[]> {
  return searchPublicClubPlayers(publicSlug, query, excludeIds, categoryName);
}

export async function loadManagedPairAction(
  publicSlug: string,
  manageToken: string,
): Promise<
  { ok: true; pair: PublicManagedPair } | { ok: false; error: string }
> {
  return findPublicPairByManageToken(publicSlug, manageToken);
}

async function assertTokenOwnsPair(
  publicSlug: string,
  manageToken: string,
): Promise<
  | {
      ok: true;
      pairId: string;
      clubSlug: string;
      clubId: string;
      tournamentId: string;
    }
  | { ok: false; error: string }
> {
  const found = await findPublicPairByManageToken(publicSlug, manageToken);
  if (!found.ok) return found;

  const pair = await prisma.tournamentPair.findFirst({
    where: { id: found.pair.id },
    select: {
      id: true,
      tournamentId: true,
      tournament: {
        select: {
          clubId: true,
          club: { select: { slug: true } },
        },
      },
    },
  });
  if (!pair) return { ok: false, error: "Inscripción no encontrada." };

  return {
    ok: true,
    pairId: pair.id,
    clubId: pair.tournament.clubId,
    clubSlug: pair.tournament.club.slug,
    tournamentId: pair.tournamentId,
  };
}

export async function requestManagedPairCancellationAction(
  publicSlug: string,
  manageToken: string,
): Promise<
  | { ok: true; outcome: "cancelled" | "requested"; message: string }
  | { ok: false; error: string }
> {
  const ownership = await assertTokenOwnsPair(publicSlug, manageToken);
  if (!ownership.ok) return ownership;
  return requestPairCancellation({ pairId: ownership.pairId });
}

export async function updateManagedPairDayPreferenceAction(
  publicSlug: string,
  manageToken: string,
  zonesDayPreferenceRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ownership = await assertTokenOwnsPair(publicSlug, manageToken);
  if (!ownership.ok) return ownership;

  const pair = await prisma.tournamentPair.findFirst({
    where: { id: ownership.pairId },
    select: { status: true },
  });
  if (!pair || pair.status === "CANCELLED") {
    return { ok: false, error: "La inscripción no está activa." };
  }
  if (pair.status === "CANCEL_REQUESTED") {
    return { ok: false, error: "Hay un pedido de baja pendiente." };
  }

  const zonesDayPreference = parseZonesDayPreference(zonesDayPreferenceRaw);
  const repo = getTournamentRepository();
  const result = await repo.updatePairZonesDayPreference(
    ownership.clubId,
    ownership.tournamentId,
    ownership.pairId,
    zonesDayPreference as ZonesDayPreference,
  );
  if (!result.ok) {
    return { ok: false, error: result.error ?? "No se pudo guardar." };
  }

  revalidatePath(`/inscripcion/${publicSlug}`);
  revalidatePath(`/inscripcion/${publicSlug}/gestionar/${manageToken}`);
  revalidatePath(`/${ownership.clubSlug}/torneos/${ownership.tournamentId}`);
  return { ok: true };
}

/** Logged-in player: list pairs for this tournament only (for the inscription page). */
export async function getMyPairsForTournamentAction(publicSlug: string) {
  const current = await getCurrentUser();
  if (!current) return [];
  const { listUserActivePairs } = await import(
    "@/modules/tournaments/application/find-public-pair"
  );
  const pairs = await listUserActivePairs(current.user.id);
  return pairs.filter((pair) => pair.publicSlug === publicSlug);
}
