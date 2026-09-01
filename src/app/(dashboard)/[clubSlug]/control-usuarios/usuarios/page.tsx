import { redirect } from "next/navigation";

import { AdminManagement } from "@/components/features/admins/admin-management";
import { getClubAccess } from "@/lib/auth/access";
import { ensureClubUserTypes } from "@/lib/auth/user-types";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Usuarios · VeloxCourt",
};

export default async function ControlUsuariosUsuariosPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/control-usuarios/usuarios`);
  if (!access.allowedModules.includes("usuarios")) {
    redirect(
      access.allowedModules.includes("tipos-usuario")
        ? `/${clubSlug}/control-usuarios/tipo-usuario`
        : `/${clubSlug}/${access.allowedModules[0] ?? "turnos"}`,
    );
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
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Usuarios</h2>
        <p className="text-sm text-muted-foreground">
          Invitá personas y asignales un tipo de usuario del club.
        </p>
      </div>
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
