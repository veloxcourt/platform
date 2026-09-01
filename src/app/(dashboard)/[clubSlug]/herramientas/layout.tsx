import { redirect } from "next/navigation";

import { HerramientasSubnav } from "@/components/features/herramientas/herramientas-subnav";
import { firstHerramientasSlug } from "@/config/modules";
import { getClubAccess } from "@/lib/auth/access";

export default async function HerramientasLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/herramientas`);
  if (!firstHerramientasSlug(access.allowedModules)) {
    const fallback = access.allowedModules[0];
    redirect(fallback ? `/${clubSlug}/${fallback}` : "/login");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HerramientasSubnav
          clubSlug={clubSlug}
          allowedModules={access.allowedModules}
        />
        <p className="shrink-0 text-sm text-muted-foreground">
          Utilidades de apoyo para la operación del club
        </p>
      </div>

      {children}
    </div>
  );
}
