"use server";

import { revalidatePath } from "next/cache";

import { requireClubModuleAccess } from "@/lib/auth/access";
import { ensureRuntimeSchema, prisma } from "@/lib/prisma";
import {
  createPlayerEvent,
  listPlayedTournaments,
  listPlayerEvents,
  syncPlayerTournamentEvents,
  type CreatePlayerEventResult,
  type PlayedTournamentsResult,
  type PlayerEventsResult,
  type SyncTournamentEventsResult,
} from "@/modules/players/application/player-events";
import { createPlayerEventSchema } from "@/modules/players/domain/player-event";

async function findPlayerMembership(clubId: string, playerId: string) {
  return prisma.membership.findFirst({
    where: { clubId, userId: playerId, role: "PLAYER" },
    select: {
      id: true,
      inviteSentAt: true,
      inviteForTournamentId: true,
    },
  });
}

export async function setPlayerInviteSentAction(
  clubSlug: string,
  playerId: string,
  tournamentId: string | null,
  sent: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireClubModuleAccess(clubSlug, "jugadores");
  await ensureRuntimeSchema();

  const membership = await findPlayerMembership(access.club.id, playerId);
  if (!membership) return { ok: false, error: "Jugador no encontrado" };

  const tournamentChanged = membership.inviteForTournamentId !== tournamentId;
  await prisma.membership.update({
    where: { id: membership.id },
    data: sent
      ? {
          inviteSentAt: new Date(),
          inviteForTournamentId: tournamentId,
          ...(tournamentChanged ? { inviteNote: null } : {}),
        }
      : { inviteSentAt: null },
  });

  revalidatePath(`/${clubSlug}/jugadores`);
  return { ok: true };
}

export async function setPlayerInviteNoteAction(
  clubSlug: string,
  playerId: string,
  tournamentId: string | null,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireClubModuleAccess(clubSlug, "jugadores");
  await ensureRuntimeSchema();

  const membership = await findPlayerMembership(access.club.id, playerId);
  if (!membership) return { ok: false, error: "Jugador no encontrado" };

  const trimmed = note.trim().slice(0, 500);
  const sameTournament = membership.inviteForTournamentId === tournamentId;
  const messageSentHere = membership.inviteSentAt != null && sameTournament;

  await prisma.membership.update({
    where: { id: membership.id },
    data: trimmed
      ? {
          inviteNote: trimmed,
          inviteForTournamentId: tournamentId,
          ...(sameTournament ? {} : { inviteSentAt: null }),
        }
      : messageSentHere
        ? { inviteNote: null }
        : {
            inviteNote: null,
            inviteSentAt: null,
            inviteForTournamentId: null,
          },
  });

  revalidatePath(`/${clubSlug}/jugadores`);
  return { ok: true };
}

export async function listPlayerEventsAction(
  clubSlug: string,
  playerId: string,
): Promise<PlayerEventsResult> {
  const access = await requireClubModuleAccess(clubSlug, "jugadores");
  return listPlayerEvents(access.club.id, playerId);
}

export async function listPlayedTournamentsAction(
  clubSlug: string,
  playerId: string,
): Promise<PlayedTournamentsResult> {
  const access = await requireClubModuleAccess(clubSlug, "jugadores");
  return listPlayedTournaments(access.club.id, playerId);
}

export async function syncPlayerTournamentEventsAction(
  clubSlug: string,
  playerId: string,
): Promise<SyncTournamentEventsResult> {
  const access = await requireClubModuleAccess(clubSlug, "jugadores");
  const result = await syncPlayerTournamentEvents(
    access.club.id,
    playerId,
    access.user.id,
    access.user.fullName,
  );
  if (result.ok) revalidatePath(`/${clubSlug}/jugadores`);
  return result;
}

export async function createPlayerEventAction(
  clubSlug: string,
  playerId: string,
  input: unknown,
): Promise<CreatePlayerEventResult> {
  const access = await requireClubModuleAccess(clubSlug, "jugadores");
  const parsed = createPlayerEventSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos del suceso inválidos",
    };
  }

  const result = await createPlayerEvent(
    access.club.id,
    playerId,
    access.user.id,
    access.user.fullName,
    parsed.data,
  );
  if (result.ok) revalidatePath(`/${clubSlug}/jugadores`);
  return result;
}
