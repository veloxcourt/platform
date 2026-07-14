import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TournamentCategoriesPanel } from "@/components/features/torneos/tournament-categories-panel";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { getTournamentCategories } from "@/modules/tournaments/application/get-tournament-categories";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

export const metadata = {
  title: "Categorías del torneo · VeloxCourt",
};

export default async function TorneoCategoriasPage({
  params,
}: {
  params: Promise<{ clubSlug: string; tournamentId: string }>;
}) {
  const { clubSlug, tournamentId } = await params;

  const repo = getTournamentRepository();
  const data = await getTournamentCategories(repo, clubSlug, tournamentId);
  if (!data) notFound();

  const bookingRepo = getBookingRepository();
  const [courts, config] = await Promise.all([
    bookingRepo.getCourts(data.club.id),
    repo.getTournamentConfig(data.club.id, tournamentId),
  ]);
  const clubCourtCount = courts.filter((c) => c.active).length;
  const courtCount = config?.courtCount || clubCourtCount || 1;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/${clubSlug}/torneos/${tournamentId}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Volver al torneo
        </Link>
        <h1 className="text-xl font-semibold">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          {data.tournament.name} · cada categoría compite con reglas propias
        </p>
      </div>

      <TournamentCategoriesPanel
        clubSlug={clubSlug}
        tournamentId={tournamentId}
        categories={data.categories}
        levels={data.levels}
        config={config}
        courtCount={courtCount}
      />
    </div>
  );
}
