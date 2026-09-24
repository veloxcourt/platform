import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { PublicInscriptionAuthBanner } from "@/components/features/torneos/public-inscription-auth-banner";
import { PublicInscriptionForm } from "@/components/features/torneos/public-inscription-form";
import { PublicInscriptionManage } from "@/components/features/torneos/public-inscription-manage";
import { getCurrentUser } from "@/lib/auth/access";
import { formatShortDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getPublicTournament } from "@/modules/tournaments/application/get-public-tournament";
import { TOURNAMENT_STATUS_LABELS } from "@/modules/tournaments/domain/tournament-schema";
import type { Gender } from "@/modules/bookings/domain/new-player-schema";

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

  const current = await getCurrentUser();
  let loggedInPlayer: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string | null;
    gender: Gender | null;
    city: string | null;
  } | null = null;

  if (current) {
    const club = await prisma.tournament.findFirst({
      where: { publicSlug },
      select: { clubId: true },
    });
    if (club) {
      const membership = await prisma.membership.findFirst({
        where: {
          clubId: club.clubId,
          userId: current.user.id,
          role: "PLAYER",
        },
        select: { id: true },
      });
      if (!membership) {
        await prisma.membership.create({
          data: {
            clubId: club.clubId,
            userId: current.user.id,
            role: "PLAYER",
          },
        });
      }
    }

    loggedInPlayer = {
      id: current.user.id,
      firstName: current.user.firstName ?? "",
      lastName: current.user.lastName ?? "",
      fullName: current.user.fullName,
      phone: current.user.phone,
      gender: (current.user.gender as Gender | null) ?? null,
      city: current.user.city ?? null,
    };
  }

  const dates =
    tournament.endDate && tournament.endDate !== tournament.startDate
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
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">{tournament.club.name}</p>
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

        <PublicInscriptionAuthBanner
          publicSlug={tournament.publicSlug}
          loggedInName={loggedInPlayer?.fullName}
        />

        {tournament.acceptsInscriptions ? (
          <PublicInscriptionForm
            publicSlug={tournament.publicSlug}
            categories={tournament.categories}
            config={tournament.config}
            pickerCategories={tournament.pickerCategories}
            preferenceReservations={tournament.preferenceReservations}
            loggedInPlayer={loggedInPlayer}
          />
        ) : (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            {tournament.categories.length === 0
              ? "Este torneo todavía no tiene categorías para inscribirse."
              : "Las inscripciones de este torneo no están abiertas."}
          </p>
        )}

        <PublicInscriptionManage
          publicSlug={tournament.publicSlug}
          isLoggedIn={Boolean(loggedInPlayer)}
        />
      </div>
    </main>
  );
}
