import { redirect } from "next/navigation";

import { UserTypeManagement } from "@/components/features/admins/user-type-management";
import { getClubAccess } from "@/lib/auth/access";
import { toModuleKeys } from "@/lib/auth/permissions";
import { ensureClubUserTypes } from "@/lib/auth/user-types";
import { prisma } from "@/lib/prisma";

export default async function UserTypesPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/tipos-usuario`);
  if (!access.allowedModules.includes("tipos-usuario")) {
    redirect(`/${clubSlug}/${access.allowedModules[0] ?? "turnos"}`);
  }

  await ensureClubUserTypes(access.club.id);

  const userTypes = await prisma.clubUserType.findMany({
    where: { clubId: access.club.id },
    include: { _count: { select: { memberships: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-2">
      <h1 className="text-2xl font-bold">Tipos de usuario</h1>
      <p className="pb-4 text-sm text-muted-foreground">
        Definí perfiles del club y configurá qué privilegios tiene cada uno.
      </p>
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
