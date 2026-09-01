import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, LogOut } from "lucide-react";

import { logoutAction } from "@/app/(auth)/login/actions";
import { ClubSwitcher } from "@/components/features/dashboard/club-switcher";
import { DashboardNav } from "@/components/features/dashboard/dashboard-nav";
import { getClubAccess } from "@/lib/auth/access";
import { firstDestinationModule } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/turnos`);

  const memberships = await prisma.membership.findMany({
    where: {
      userId: access.user.id,
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

  const clubs = memberships.map((membership) => {
    const privileges =
      membership.userType?.privileges ?? membership.allowedModules;
    const destination = firstDestinationModule(privileges, membership.role);
    return {
      slug: membership.club.slug,
      name: membership.club.name,
      href: `/${membership.club.slug}/${destination}`,
    };
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-background">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <CalendarClock className="size-4" />
            </span>
            VeloxCourt
          </Link>
          <ClubSwitcher currentSlug={clubSlug} clubs={clubs} />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {access.user.fullName}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>

        <Suspense fallback={null}>
          <DashboardNav
            clubSlug={clubSlug}
            allowedModules={access.allowedModules}
            navOrder={access.navOrder}
            isOwner={access.isOwner}
          />
        </Suspense>
      </header>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto p-4">
        {children}
      </main>
    </div>
  );
}
