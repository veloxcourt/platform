import { prisma } from "@/lib/prisma";

/// La observación de la ficha es la nota de invitación del torneo vigente.
export function visiblePlayerObservation(
  inviteNote: string | null | undefined,
  inviteForTournamentId: string | null | undefined,
  latestTournamentId: string | null,
): string {
  if (!inviteNote) return "";
  if (!latestTournamentId) {
    return inviteForTournamentId == null ? inviteNote : "";
  }
  return inviteForTournamentId === latestTournamentId ? inviteNote : "";
}

export async function latestClubTournamentId(
  clubId: string,
): Promise<string | null> {
  const latest = await prisma.tournament.findFirst({
    where: { clubId },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  return latest?.id ?? null;
}

export async function writePlayerObservation(
  membership: {
    id: string;
    inviteSentAt: Date | null;
    inviteForTournamentId: string | null;
  },
  tournamentId: string | null,
  note: string,
): Promise<void> {
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
}
