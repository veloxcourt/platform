import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { PublicInscriptionForm } from "@/components/features/torneos/public-inscription-form";
import { formatShortDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { getPublicTournament } from "@/modules/tournaments/application/get-public-tournament";
import { TOURNAMENT_STATUS_LABELS } from "@/modules/tournaments/domain/tournament-schema";

export const metadata = {
  title: "Inscripción · VeloxCourt",
};

export default async function PublicInscriptionPage({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const { publicSlug } = await params;
  const tournament = await getPublicTournament(publicSlug);
  if (!tournament) notFound();

  const dates = tournament.endDate && tournament.endDate !== tournament.startDate
    ? `${formatShortDate(tournament.startDate)} – ${formatShortDate(tournament.endDate)}`
    : formatShortDate(tournament.startDate);

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex items-start gap-3">
          {tournament.club.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tournament.club.logoUrl}
              alt=""
              className="size-12 rounded-xl object-cover"
            />
          ) : (
            <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <CalendarClock className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{tournament.club.name}</p>
            <h1 className="text-xl font-semibold tracking-tight">{tournament.name}</h1>
            <p className="text-sm text-muted-foreground">
              {dates}
              {" · "}
              {tournament.fee > 0
                ? formatMoney(tournament.fee, tournament.club.currency)
                : "Sin cargo"}
              {" · "}
              {TOURNAMENT_STATUS_LABELS[tournament.status]}
            </p>
          </div>
        </header>

        {tournament.description ? (
          <p className="text-sm text-muted-foreground">{tournament.description}</p>
        ) : null}

        {tournament.acceptsInscriptions ? (
          <PublicInscriptionForm
            publicSlug={tournament.publicSlug}
            categories={tournament.categories}
            config={tournament.config}
            pickerCategories={tournament.pickerCategories}
            preferenceReservations={tournament.preferenceReservations}
          />
        ) : (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            {tournament.categories.length === 0
              ? "Este torneo todavía no tiene categorías para inscribirse."
              : "Las inscripciones de este torneo no están abiertas."}
          </p>
        )}
      </div>
    </main>
  );
}
