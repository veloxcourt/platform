import { redirect } from "next/navigation";

import { ControlUsuariosSubnav } from "@/components/features/admins/control-usuarios-subnav";
import { getClubAccess } from "@/lib/auth/access";

export default async function ControlUsuariosLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/control-usuarios`);
  if (
    !access.allowedModules.includes("tipos-usuario") &&
    !access.allowedModules.includes("usuarios")
  ) {
    const fallback = access.allowedModules[0];
    redirect(fallback ? `/${clubSlug}/${fallback}` : "/login");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ControlUsuariosSubnav
          clubSlug={clubSlug}
          allowedModules={access.allowedModules}
        />
        <p className="shrink-0 text-sm text-muted-foreground">
          Tipos de perfil y usuarios del club
        </p>
      </div>

      {children}
    </div>
  );
}
