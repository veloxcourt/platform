import { prisma } from "@/lib/prisma";
import { getClubProfile } from "@/modules/clubs/infrastructure/club-profile";

function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type PublicTournament = {
  publicSlug: string;
  type: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "OPEN" | "CLOSED" | "FINISHED";
  startDate: string;
  endDate: string | null;
  fee: number;
  acceptsInscriptions: boolean;
  club: {
    name: string;
    logoUrl: string | null;
    locality: string | null;
    currency: string;
  };
  categories: { id: string; name: string }[];
};

export async function getPublicTournament(
  publicSlug: string,
): Promise<PublicTournament | null> {
  const tournament = await prisma.tournament.findFirst({
    where: { publicSlug },
    include: {
      club: { select: { id: true, name: true, currency: true } },
      categories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      },
    },
  });
  if (!tournament) return null;

  const profile = await getClubProfile(tournament.club.id);

  return {
    publicSlug: tournament.publicSlug,
    type: tournament.type,
    name: tournament.name,
    description: tournament.description,
    status: tournament.status,
    startDate: fromDbDate(tournament.startDate),
    endDate: tournament.endDate ? fromDbDate(tournament.endDate) : null,
    fee: tournament.fee,
    acceptsInscriptions:
      tournament.type === "ZONAS" &&
      (tournament.status === "OPEN" || tournament.status === "DRAFT") &&
      tournament.categories.length > 0,
    club: {
      name: tournament.club.name,
      logoUrl: profile?.logoUrl ?? null,
      locality: profile?.locality ?? null,
      currency: tournament.club.currency,
    },
    categories: tournament.categories,
  };
}
