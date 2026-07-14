import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TournamentZonesPanel } from "@/components/features/torneos/tournament-zones-panel";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { getZonasTournamentDetail } from "@/modules/tournaments/application/get-zonas-tournament-detail";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

export const metadata = {
  title: "Zonas del torneo · CourtFlow",
};

export default async function TorneoZonasCategoriaPage({
  params,
}: {
  params: Promise<{
    clubSlug: string;
    tournamentId: string;
    categoryId: string;
  }>;
}) {
  const { clubSlug, tournamentId, categoryId } = await params;

  const repo = getTournamentRepository();
  const data = await getZonasTournamentDetail(repo, clubSlug, tournamentId);
  if (!data) notFound();

  const category = data.tournament.categories.find((c) => c.id === categoryId);
  if (!category) notFound();

  const bookingRepo = getBookingRepository();
  const [courts, config] = await Promise.all([
    bookingRepo.getCourts(data.club.id),
    repo.getTournamentConfig(data.club.id, tournamentId),
  ]);
  const clubCourtCount = courts.filter((c) => c.active).length;
  const courtCount = config?.courtCount || clubCourtCount || 1;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/${clubSlug}/torneos/${tournamentId}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Volver al torneo
        </Link>
        <h1 className="text-xl font-semibold">Zonas · {category.name}</h1>
        <p className="text-sm text-muted-foreground">
          {data.tournament.name} · recuadros y partidos de la fase de grupos
        </p>
      </div>

      <TournamentZonesPanel
        clubSlug={clubSlug}
        tournamentId={tournamentId}
        categories={data.tournament.categories}
        pairs={data.tournament.pairs}
        config={config}
        courtCount={courtCount}
        initialCategoryId={categoryId}
        lockCategory
        reservations={data.tournament.slotReservations}
      />
    </div>
  );
}
