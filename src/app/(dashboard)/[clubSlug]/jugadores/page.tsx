import { notFound } from "next/navigation";

import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { getPlayersList } from "@/modules/bookings/application/get-players-list";
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Jugadores</h1>
        <p className="text-sm text-muted-foreground">
          {data.club.name} · {data.players.length} jugadores
        </p>
      </div>

      <PlayersTable
        clubSlug={clubSlug}
        currency={data.club.currency}
        players={data.players}
        categories={data.categories}
      />
    </div>
  );
}
