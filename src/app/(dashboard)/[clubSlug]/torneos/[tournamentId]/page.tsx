import { notFound } from "next/navigation";

import { ZonasTournamentDetail } from "@/components/features/torneos/zonas-tournament-detail";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { getZonasTournamentDetail } from "@/modules/tournaments/application/get-zonas-tournament-detail";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

export const metadata = {
  title: "Torneo por zonas · VeloxCourt",
};

export default async function TorneoDetailPage({
  params,
}: {
  params: Promise<{ clubSlug: string; tournamentId: string }>;
}) {
  const { clubSlug, tournamentId } = await params;

  const repo = getTournamentRepository();
  const data = await getZonasTournamentDetail(repo, clubSlug, tournamentId);
  if (!data) notFound();

  const bookingRepo = getBookingRepository();
  const [players, courts, config] = await Promise.all([
    bookingRepo.getPlayers(data.club.id),
    bookingRepo.getCourts(data.club.id),
    repo.getTournamentConfig(data.club.id, tournamentId),
  ]);
  const clubCourtCount = courts.filter((c) => c.active).length;
  const courtCount = config?.courtCount || clubCourtCount || 1;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col">
      <ZonasTournamentDetail
        clubSlug={clubSlug}
        currency={data.club.currency}
        tournament={data.tournament}
        catalogCategories={data.catalogCategories}
        players={players}
        config={config}
        courtCount={courtCount}
      />
    </div>
  );
}
