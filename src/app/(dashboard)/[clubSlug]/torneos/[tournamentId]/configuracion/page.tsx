import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { TournamentConfigForm } from "@/components/features/torneos/tournament-config-form";
import { getTournamentConfig } from "@/modules/tournaments/application/get-tournament-config";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

export const metadata = {
  title: "Configuración del torneo · CourtFlow",
};

export default async function TorneoConfiguracionPage({
  params,
}: {
  params: Promise<{ clubSlug: string; tournamentId: string }>;
}) {
  const { clubSlug, tournamentId } = await params;

  const repo = getTournamentRepository();
  const data = await getTournamentConfig(repo, clubSlug, tournamentId);
  if (!data) notFound();

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
        <h1 className="text-xl font-semibold">Configuración del torneo</h1>
        <p className="text-sm text-muted-foreground">
          {data.config.tournamentName} · formato por categoría · días y horarios
          comunes a todo el torneo
        </p>
      </div>

      <TournamentConfigForm
        clubSlug={clubSlug}
        tournamentId={tournamentId}
        initial={data.config}
      />
    </div>
  );
}
