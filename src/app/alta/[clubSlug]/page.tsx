import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { PublicPlayerSignupForm } from "@/components/features/players/public-player-signup-form";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}): Promise<Metadata> {
  const { clubSlug } = await params;
  const club = await prisma.club.findUnique({
    where: { slug: clubSlug },
    select: { name: true },
  });
  return {
    title: club ? `Alta de jugador · ${club.name}` : "Alta de jugador · VeloxCourt",
  };
}

export default async function PublicPlayerSignupPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const club = await prisma.club.findUnique({
    where: { slug: clubSlug },
    select: { name: true, logoUrl: true, categories: true },
  });
  if (!club) notFound();

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <header className="flex items-start gap-3">
          {club.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={club.logoUrl}
              alt=""
              className="size-12 rounded-xl object-cover"
            />
          ) : (
            <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
              <CalendarClock className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {club.name}
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Alta de jugador</h1>
            <p className="text-sm text-muted-foreground">
              Completá tus datos para quedar en el listado del club.
            </p>
          </div>
        </header>

        <PublicPlayerSignupForm
          clubSlug={clubSlug}
          clubName={club.name}
          categories={club.categories}
        />
      </div>
    </main>
  );
}
