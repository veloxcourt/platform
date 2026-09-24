import { redirect } from "next/navigation";

import { CatalogoSubnav } from "@/components/features/catalog/catalogo-subnav";
import { firstCatalogoSlug } from "@/config/modules";
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
  if (!firstCatalogoSlug(access.allowedModules)) {
    const fallback = access.allowedModules[0];
    redirect(fallback ? `/${clubSlug}/${fallback}` : "/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Catálogo</h1>
        <CatalogoSubnav
          clubSlug={clubSlug}
          allowedModules={access.allowedModules}
        />
      </div>
      {children}
    </div>
  );
}
