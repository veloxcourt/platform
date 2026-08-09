import { redirect } from "next/navigation";

import { AdminManagement } from "@/components/features/admins/admin-management";
import { getClubAccess } from "@/lib/auth/access";
import { ensureClubUserTypes } from "@/lib/auth/user-types";
import { prisma } from "@/lib/prisma";

export default async function AdministratorsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/administradores`);
  if (!access.allowedModules.includes("usuarios")) {
    redirect(`/${clubSlug}/${access.allowedModules[0] ?? "turnos"}`);
  }

  await ensureClubUserTypes(access.club.id);

  const [memberships, userTypes] = await Promise.all([
    prisma.membership.findMany({
      where: { clubId: access.club.id, role: "CLUB_ADMIN" },
      include: {
        user: { select: { fullName: true, email: true } },
        userType: { select: { id: true, name: true } },
      },
      orderBy: [{ staffStatus: "asc" }, { user: { fullName: "asc" } }],
    }),
    prisma.clubUserType.findMany({
      where: { clubId: access.club.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-2">
      <h1 className="text-2xl font-bold">Usuarios</h1>
      <p className="pb-4 text-sm text-muted-foreground">
        Invitá personas y asignales un tipo de usuario del club.
      </p>
      <AdminManagement
        clubSlug={clubSlug}
        userTypes={userTypes}
        administrators={memberships.map((membership) => ({
          membershipId: membership.id,
          fullName: membership.user.fullName,
          email: membership.user.email ?? "",
          userTypeId: membership.userType?.id ?? null,
          userTypeName: membership.userType?.name ?? null,
          status: membership.staffStatus ?? "INVITED",
        }))}
      />
    </div>
  );
}
