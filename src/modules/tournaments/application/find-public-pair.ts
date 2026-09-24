import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import type { Gender } from "@/modules/bookings/domain/new-player-schema";
import {
  pairManagePath,
  type PublicManagedPair,
  type PublicManagedPairDetails,
  type PublicManagedPlayer,
} from "@/modules/tournaments/domain/pair-manage";
import type { RegistrationStatus } from "@/modules/tournaments/domain/types";
import { parseZonesDayPreference } from "@/modules/tournaments/domain/zones-day-preference";

export type { PublicManagedPair, PublicManagedPairDetails };
export { pairManagePath };

function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function playerName(user: {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  if (user.firstName || user.lastName) {
    return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  }
  return user.fullName;
}

function asGender(value: unknown): Gender | null {
  if (value === "MALE" || value === "FEMALE" || value === "OTHER") return value;
  return null;
}

function toManagedPlayer(user: {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  gender: unknown;
  city: string | null;
}): PublicManagedPlayer {
  const name = playerName(user);
  const [first = "", ...rest] = name.split(/\s+/);
  return {
    id: user.id,
    firstName: user.firstName || first,
    lastName: user.lastName || rest.join(" "),
    phone: user.phone,
    gender: asGender(user.gender),
    city: user.city,
  };
}

export function createManageToken(): string {
  return randomBytes(24).toString("base64url");
}

async function ensureManageToken(
  pairId: string,
  existing: string | null,
): Promise<string> {
  if (existing) return existing;
  const manageToken = createManageToken();
  await prisma.tournamentPair.update({
    where: { id: pairId },
    data: { manageToken },
  });
  return manageToken;
}

export async function ensurePairManagePath(
  clubId: string,
  tournamentId: string,
  pairId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const pair = await prisma.tournamentPair.findFirst({
    where: {
      id: pairId,
      tournamentId,
      tournament: { clubId },
      status: { not: "CANCELLED" },
    },
    select: {
      manageToken: true,
      tournament: { select: { publicSlug: true } },
    },
  });
  if (!pair) return { ok: false, error: "Pareja no encontrada." };
  const token = await ensureManageToken(pairId, pair.manageToken);
  return { ok: true, path: pairManagePath(pair.tournament.publicSlug, token) };
}

const PLAYER_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  phone: true,
  gender: true,
  city: true,
} as const;

export async function findPublicPairByManageToken(
  publicSlug: string,
  manageToken: string,
): Promise<
  | { ok: true; pair: PublicManagedPairDetails }
  | { ok: false; error: string }
> {
  const token = manageToken.trim();
  if (!token) return { ok: false, error: "Link inválido." };

  const pair = await prisma.tournamentPair.findFirst({
    where: {
      manageToken: token,
      tournament: { publicSlug },
      status: { not: "CANCELLED" },
    },
    include: {
      category: { select: { id: true, name: true } },
      player1: { select: PLAYER_SELECT },
      player2: { select: PLAYER_SELECT },
      slotReservations: {
        select: {
          playDate: true,
          slotIndex: true,
          startTime: true,
          endTime: true,
        },
        orderBy: [{ playDate: "asc" }, { slotIndex: "asc" }],
      },
      tournament: {
        select: {
          name: true,
          publicSlug: true,
          club: { select: { name: true } },
        },
      },
    },
  });

  if (!pair || !pair.manageToken) {
    return { ok: false, error: "No encontramos esa inscripción." };
  }

  return {
    ok: true,
    pair: {
      id: pair.id,
      status: pair.status as RegistrationStatus,
      categoryId: pair.category.id,
      categoryName: pair.category.name,
      zonesDayPreference: parseZonesDayPreference(pair.zonesDayPreference),
      player1Name: playerName(pair.player1),
      player2Name: pair.player2 ? playerName(pair.player2) : null,
      tournamentName: pair.tournament.name,
      clubName: pair.tournament.club.name,
      publicSlug: pair.tournament.publicSlug,
      manageToken: pair.manageToken,
      player1: toManagedPlayer(pair.player1),
      player2: pair.player2 ? toManagedPlayer(pair.player2) : null,
      slots: pair.slotReservations.map((slot) => ({
        playDate: fromDbDate(slot.playDate),
        slotIndex: slot.slotIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    },
  };
}

export async function listUserActivePairs(userId: string): Promise<
  Array<
    PublicManagedPair & {
      tournamentId: string;
      startDate: string;
    }
  >
> {
  const pairs = await prisma.tournamentPair.findMany({
    where: {
      status: { not: "CANCELLED" },
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { id: true, name: true } },
      player1: {
        select: { fullName: true, firstName: true, lastName: true },
      },
      player2: {
        select: { fullName: true, firstName: true, lastName: true },
      },
      tournament: {
        select: {
          id: true,
          name: true,
          publicSlug: true,
          startDate: true,
          club: { select: { name: true } },
        },
      },
    },
  });

  const result: Array<
    PublicManagedPair & { tournamentId: string; startDate: string }
  > = [];

  for (const pair of pairs) {
    const manageToken = await ensureManageToken(pair.id, pair.manageToken);
    result.push({
      id: pair.id,
      status: pair.status as RegistrationStatus,
      categoryId: pair.category.id,
      categoryName: pair.category.name,
      zonesDayPreference: parseZonesDayPreference(pair.zonesDayPreference),
      player1Name: playerName(pair.player1),
      player2Name: pair.player2 ? playerName(pair.player2) : null,
      tournamentName: pair.tournament.name,
      clubName: pair.tournament.club.name,
      publicSlug: pair.tournament.publicSlug,
      manageToken,
      tournamentId: pair.tournament.id,
      startDate: pair.tournament.startDate.toISOString().slice(0, 10),
    });
  }

  return result;
}
