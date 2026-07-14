import { notFound, redirect } from "next/navigation";

import { EcoTorneoView } from "@/components/features/herramientas/eco-torneo-view";
import { getHerramientasRepository } from "@/modules/herramientas/infrastructure/repository";

export const metadata = {
  title: "Eco-Torneo · VeloxCourt",
};

export default async function EcoTorneoPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { clubSlug } = await params;
  const { s: selectedId } = await searchParams;

  const repo = getHerramientasRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) notFound();

  const simulations = await repo.listEcoTorneoSimulations(club.id);
  const validSelected =
    selectedId && simulations.some((sim) => sim.id === selectedId)
      ? selectedId
      : null;

  if (simulations.length > 0 && !validSelected) {
    redirect(
      `/${clubSlug}/herramientas/eco-torneo?s=${simulations[0].id}`,
    );
  }

  const active = validSelected
    ? await repo.getEcoTorneoSimulation(club.id, validSelected)
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Eco-Torneo</h2>
        <p className="text-sm text-muted-foreground">
          Planilla para estimar costos e ingresos al armar un torneo de pádel.
        </p>
      </div>

      <EcoTorneoView
        clubSlug={clubSlug}
        currency={club.currency}
        simulations={simulations}
        active={active}
      />
    </div>
  );
}
