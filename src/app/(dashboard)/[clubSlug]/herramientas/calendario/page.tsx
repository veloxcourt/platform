import { notFound, redirect } from "next/navigation";

import { CalendarioTorneosView } from "@/components/features/herramientas/calendario-torneos-view";
import { getClubAccess } from "@/lib/auth/access";
import { getHerramientasRepository } from "@/modules/herramientas/infrastructure/repository";

export const metadata = {
  title: "Calendario · VeloxCourt",
};

export default async function CalendarioPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/herramientas/calendario`);
  if (!access.allowedModules.includes("calendario")) {
    redirect(
      access.allowedModules.includes("eco-torneo")
        ? `/${clubSlug}/herramientas/eco-torneo`
        : `/${clubSlug}/${access.allowedModules[0] ?? "turnos"}`,
    );
  }

  const repo = getHerramientasRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) notFound();

  const state = await repo.getCalendarPlannerState(club.id);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Calendario de torneos</h2>
        <p className="text-sm text-muted-foreground">
          Timeline horizontal para ver congestión por club y no cruzar
          categorías con otros torneos.
        </p>
      </div>

      <CalendarioTorneosView
        clubSlug={clubSlug}
        initialClubs={state.clubs}
        initialCategories={state.categories}
        initialTournaments={state.tournaments}
        initialLibreFill={state.settings.libreFill}
        initialLibreBorder={state.settings.libreBorder}
        initialSearchLinks={state.searchLinks}
      />
    </div>
  );
}
