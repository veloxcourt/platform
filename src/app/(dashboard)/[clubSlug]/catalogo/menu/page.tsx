import { notFound } from "next/navigation";

import { requireClubAnyModuleAccess } from "@/lib/auth/access";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { PriceMenuLinkButton } from "@/components/features/catalog/client-menu-qr-dialog";
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
  await requireClubAnyModuleAccess(clubSlug, ["menu-precios", "catalogo"]);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">{club.name}</p>
        <PriceMenuLinkButton clubSlug={clubSlug} />
      </div>
      <PriceMenu currency={club.currency} products={products} types={types} />
    </div>
  );
}
