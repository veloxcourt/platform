import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { PairManagePanel } from "@/components/features/torneos/pair-manage-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findPublicPairByManageToken } from "@/modules/tournaments/application/find-public-pair";
import { getPublicTournament } from "@/modules/tournaments/application/get-public-tournament";

export const metadata = {
  title: "Gestionar inscripción · VeloxCourt",
};

export default async function ManageInscriptionPage({
  params,
}: {
  params: Promise<{ publicSlug: string; token: string }>;
}) {
  const { publicSlug, token } = await params;
  const [found, tournament] = await Promise.all([
    findPublicPairByManageToken(publicSlug, token),
    getPublicTournament(publicSlug),
  ]);
  if (!found.ok || !tournament) notFound();

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CalendarClock className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{found.pair.clubName}</p>
            <h1 className="text-xl font-semibold tracking-tight">
              Gestionar inscripción
            </h1>
            <p className="text-sm text-muted-foreground">
              Link privado de la pareja. Podés editar los datos o dar de baja.
            </p>
          </div>
        </header>

        <PairManagePanel
          publicSlug={publicSlug}
          manageToken={token}
          initialPair={found.pair}
          categories={tournament.categories}
          config={tournament.config}
          pickerCategories={tournament.pickerCategories}
          preferenceReservations={tournament.preferenceReservations}
        />

        <Link
          href={`/inscripcion/${publicSlug}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Volver a la ficha pública
        </Link>
      </div>
    </main>
  );
}
