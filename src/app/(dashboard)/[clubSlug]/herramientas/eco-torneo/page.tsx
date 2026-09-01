import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { EcoTorneoHeaderActions } from "@/components/features/herramientas/eco-torneo-header-actions";
import { EcoTorneoView } from "@/components/features/herramientas/eco-torneo-view";
import { getClubAccess } from "@/lib/auth/access";
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
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/herramientas/eco-torneo`);
  if (!access.allowedModules.includes("eco-torneo")) {
    redirect(
      access.allowedModules.includes("calendario")
        ? `/${clubSlug}/herramientas/calendario`
        : `/${clubSlug}/${access.allowedModules[0] ?? "turnos"}`,
    );
  }
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Eco-Torneo</h2>
          <p className="text-sm text-muted-foreground">
            Planilla para estimar costos e ingresos al armar un torneo de pádel.
          </p>
        </div>
        <Suspense fallback={null}>
          <EcoTorneoHeaderActions clubSlug={clubSlug} />
        </Suspense>
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
