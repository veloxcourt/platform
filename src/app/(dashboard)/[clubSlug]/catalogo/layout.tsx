import { redirect } from "next/navigation";

import { getClubAccess } from "@/lib/auth/access";

export default async function CatalogLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access) redirect(`/login?next=/${clubSlug}/catalogo`);
  if (
    !access.allowedModules.includes("catalogo") &&
    !access.allowedModules.includes("menu-precios")
  ) {
    const fallback = access.allowedModules[0];
    redirect(fallback ? `/${clubSlug}/${fallback}` : "/login");
  }
  return children;
}
