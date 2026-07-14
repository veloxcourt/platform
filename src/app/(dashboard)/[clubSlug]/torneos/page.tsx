import { notFound } from "next/navigation";

import { TournamentsTable } from "@/components/features/torneos/tournaments-table";
import { getTournamentsList } from "@/modules/tournaments/application/get-tournaments-list";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

export const metadata = {
  title: "Torneos · VeloxCourt",
};

export default async function TorneosPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;

  const repo = getTournamentRepository();
  const data = await getTournamentsList(repo, clubSlug);
  if (!data) notFound();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Torneos</h1>
        <p className="text-sm text-muted-foreground">
          {data.club.name} · {data.tournaments.length} torneos
        </p>
      </div>

      <TournamentsTable
        clubSlug={clubSlug}
        currency={data.club.currency}
        tournaments={data.tournaments}
      />
    </div>
  );
}
