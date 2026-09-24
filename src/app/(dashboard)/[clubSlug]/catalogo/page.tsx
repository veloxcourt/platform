import { notFound } from "next/navigation";

import { enforceClubModulePage } from "@/lib/auth/access";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { CatalogView } from "@/components/features/catalog/catalog-view";
import {
  ClientMenuQrButton,
  PriceMenuLinkButton,
} from "@/components/features/catalog/client-menu-qr-dialog";
import { ExportCatalogButton } from "@/components/features/catalog/export-catalog-dialog";

export const metadata = {
  title: "Catálogo · VeloxCourt",
};

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  await enforceClubModulePage(clubSlug, "catalogo");

  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) notFound();

  const [products, types] = await Promise.all([
    repo.listProducts(club.id),
    repo.listProductTypes(club.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {club.name} · productos y tipos
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ExportCatalogButton clubSlug={clubSlug} />
          <ClientMenuQrButton clubSlug={clubSlug} />
          <PriceMenuLinkButton clubSlug={clubSlug} />
        </div>
      </div>

      <CatalogView
        clubSlug={clubSlug}
        currency={club.currency}
        products={products}
        types={types}
      />
    </div>
  );
}
