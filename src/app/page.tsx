import Link from "next/link";
import { CalendarClock, ArrowRight } from "lucide-react";

import { ClubRequestForm } from "@/components/features/platform/club-request-form";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/access";
import { getSuperAdminAccess } from "@/lib/auth/superadmin";
import { firstDestinationModule } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export default async function Home() {
  const current = await getCurrentUser();
  const superAdmin = await getSuperAdminAccess();

  const clubHomes: { name: string; href: string }[] = [];
  if (current) {
    const memberships = await prisma.membership.findMany({
      where: {
        userId: current.user.id,
        OR: [
          { role: "OWNER" },
          { role: "CLUB_ADMIN", staffStatus: "ACTIVE" },
        ],
      },
      include: {
        club: { select: { slug: true, name: true } },
        userType: { select: { privileges: true } },
      },
      orderBy: { club: { name: "asc" } },
    });
    for (const membership of memberships) {
      const privileges =
        membership.userType?.privileges ?? membership.allowedModules;
      const destinationModule = firstDestinationModule(
        privileges,
        membership.role,
      );
      clubHomes.push({
        name: membership.club.name,
        href: `/${membership.club.slug}/${destinationModule}`,
      });
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.08),_transparent_45%),linear-gradient(180deg,#f7f7f5_0%,#eceae4_100%)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-md bg-foreground text-background">
            <CalendarClock className="size-4" />
          </span>
          VeloxCourt
        </div>
        <div className="flex items-center gap-2">
          {superAdmin ? (
            <Link
              href="/superadmin"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Superadmin
            </Link>
          ) : null}
          {clubHomes.length > 0 ? (
            clubHomes.map((club) => (
              // <a> fuerza navegación completa: evita 404 fantasma del soft-nav
              // con caché Turbopack en carpetas Dropbox.
              <a
                key={club.href}
                href={club.href}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                {clubHomes.length === 1 ? "Ir a mi club" : club.name}
              </a>
            ))
          ) : (
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Ingresar
            </Link>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col justify-center px-6 pb-16 pt-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Gestión de clubes de pádel
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            VeloxCourt
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Una plataforma para administrar turnos, torneos, jugadores y la
            operación diaria de tu club, con accesos claros para cada equipo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#solicitar" className={cn(buttonVariants({ size: "lg" }))}>
              Solicitar mi club
              <ArrowRight className="size-4" />
            </a>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Ya tengo acceso
            </Link>
          </div>
        </section>

        <section
          id="solicitar"
          className="border-t bg-background/70 px-6 py-16 backdrop-blur"
        >
          <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                ¿Querés administrar tu club con VeloxCourt?
              </h2>
              <p className="mt-3 max-w-md text-muted-foreground">
                Dejanos tus datos. El equipo de VeloxCourt revisa la solicitud y
                crea el club para que puedas empezar a operar.
              </p>
            </div>
            <ClubRequestForm />
          </div>
        </section>
      </main>
    </div>
  );
}
