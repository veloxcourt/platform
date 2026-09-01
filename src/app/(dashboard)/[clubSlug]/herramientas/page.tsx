import { redirect } from "next/navigation";

import { firstHerramientasSlug } from "@/config/modules";
import { getClubAccess } from "@/lib/auth/access";

export default async function HerramientasPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/herramientas`);

  const slug = firstHerramientasSlug(access.allowedModules);
  if (!slug) {
    const fallback = access.allowedModules[0];
    redirect(fallback ? `/${clubSlug}/${fallback}` : "/login");
  }

  redirect(`/${clubSlug}/herramientas/${slug}`);
}
