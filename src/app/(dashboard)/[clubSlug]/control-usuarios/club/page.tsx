import { redirect } from "next/navigation";

import { ClubProfileForm } from "@/components/features/admins/club-profile-form";
import { getClubAccess } from "@/lib/auth/access";
import { getClubProfile } from "@/modules/clubs/infrastructure/club-profile";

export const metadata = {
  title: "Club · VeloxCourt",
};

export default async function ControlUsuariosClubPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/control-usuarios/club`);
  if (access.role !== "OWNER") {
    redirect(
      access.allowedModules.includes("usuarios")
        ? `/${clubSlug}/control-usuarios/usuarios`
        : `/${clubSlug}/control-usuarios/tipo-usuario`,
    );
  }

  const profile = await getClubProfile(access.club.id);
  if (!profile) redirect(`/${clubSlug}/control-usuarios`);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Club</h2>
        <p className="text-sm text-muted-foreground">
          Logo, nombre del complejo, localidad y dirección. Solo el dueño
          puede editarlos.
        </p>
      </div>
      <ClubProfileForm clubSlug={clubSlug} initial={profile} />
    </div>
  );
}
