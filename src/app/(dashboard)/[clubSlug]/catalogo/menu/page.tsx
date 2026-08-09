import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireClubAnyModuleAccess } from "@/lib/auth/access";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { PriceMenu } from "@/components/features/catalog/price-menu";

export const metadata = {
  title: "Menú de precios · VeloxCourt",
};

export default async function MenuPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await requireClubAnyModuleAccess(clubSlug, [
    "menu-precios",
    "catalogo",
  ]);

  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) notFound();

  const [allProducts, allTypes] = await Promise.all([
    repo.listProducts(club.id),
    repo.listProductTypes(club.id),
  ]);
  const products = allProducts.filter((p) => p.active && p.showInPriceMenu);
  const publishedTypeIds = new Set(
    products.map((p) => p.typeId).filter((id): id is string => Boolean(id)),
  );
  const types = allTypes.filter((t) => publishedTypeIds.has(t.id));
  const canManageCatalog = access.allowedModules.includes("catalogo");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        {canManageCatalog ? (
          <Link
            href={`/${clubSlug}/catalogo`}
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Volver al catálogo
          </Link>
        ) : null}
        <h1 className="text-xl font-semibold">Menú de precios</h1>
        <p className="text-sm text-muted-foreground">{club.name}</p>
      </div>

      <PriceMenu currency={club.currency} products={products} types={types} />
    </div>
  );
}
