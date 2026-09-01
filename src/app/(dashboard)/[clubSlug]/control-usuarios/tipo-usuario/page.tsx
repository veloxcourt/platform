import { redirect } from "next/navigation";

import { UserTypeManagement } from "@/components/features/admins/user-type-management";
import { getClubAccess } from "@/lib/auth/access";
import { toModuleKeys } from "@/lib/auth/permissions";
import { ensureClubUserTypes } from "@/lib/auth/user-types";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Tipo Usuario · VeloxCourt",
};

export default async function TipoUsuarioPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/control-usuarios/tipo-usuario`);
  if (!access.allowedModules.includes("tipos-usuario")) {
    redirect(
      access.allowedModules.includes("usuarios")
        ? `/${clubSlug}/control-usuarios/usuarios`
        : `/${clubSlug}/${access.allowedModules[0] ?? "turnos"}`,
    );
  }

  await ensureClubUserTypes(access.club.id);

  const userTypes = await prisma.clubUserType.findMany({
    where: { clubId: access.club.id },
    include: { _count: { select: { memberships: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Tipo Usuario</h2>
        <p className="text-sm text-muted-foreground">
          Definí perfiles del club y configurá qué privilegios tiene cada uno.
        </p>
      </div>
      <UserTypeManagement
        clubSlug={clubSlug}
        userTypes={userTypes.map((type) => ({
          id: type.id,
          name: type.name,
          description: type.description,
          privileges: toModuleKeys(type.privileges),
          active: type.active,
          membersCount: type._count.memberships,
        }))}
      />
    </div>
  );
}
