import { notFound } from "next/navigation";

import { TorneosHubShell } from "@/components/features/torneos/torneos-hub-shell";
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
    <TorneosHubShell
      clubSlug={clubSlug}
      subtitle={`${data.club.name} · ${data.tournaments.length} torneos`}
    >
      <TournamentsTable
        clubSlug={clubSlug}
        currency={data.club.currency}
        tournaments={data.tournaments}
      />
    </TorneosHubShell>
  );
}
