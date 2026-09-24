import { notFound } from "next/navigation";

import { getClubAccess } from "@/lib/auth/access";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { getPlayersList } from "@/modules/bookings/application/get-players-list";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";
import { PlayersTable } from "@/components/features/players/players-table";

export const metadata = {
  title: "Jugadores · VeloxCourt",
};

export default async function JugadoresPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;

  const repo = getBookingRepository();
  const data = await getPlayersList(repo, clubSlug);
  if (!data) notFound();

  const access = await getClubAccess(clubSlug);
  const tournaments = access?.allowedModules.includes("torneos")
    ? await getTournamentRepository().listTournamentInscriptions(data.club.id)
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="shrink-0 text-sm text-muted-foreground">
        {data.club.name} · {data.players.length} jugadores
      </p>

      <PlayersTable
        clubSlug={clubSlug}
        currency={data.club.currency}
        players={data.players}
        categories={data.categories}
        tournaments={tournaments}
      />
    </div>
  );
}
