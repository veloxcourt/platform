import { redirect } from "next/navigation";

import { firstControlUsuariosSlug } from "@/config/modules";
import { getClubAccess } from "@/lib/auth/access";

export default async function ControlUsuariosPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/control-usuarios`);

  if (access.role === "OWNER") {
    redirect(`/${clubSlug}/control-usuarios/club`);
  }

  const slug = firstControlUsuariosSlug(access.allowedModules);
  if (!slug) {
    const fallback = access.allowedModules[0];
    redirect(fallback ? `/${clubSlug}/${fallback}` : "/login");
  }

  redirect(`/${clubSlug}/control-usuarios/${slug}`);
}
