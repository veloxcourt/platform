import Link from "next/link";
import { notFound } from "next/navigation";
import { ListOrdered } from "lucide-react";

import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { CatalogView } from "@/components/features/catalog/catalog-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Catálogo · CourtFlow",
};

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;

  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) notFound();

  const [products, types] = await Promise.all([
    repo.listProducts(club.id),
    repo.listProductTypes(club.id),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            {club.name} · productos y tipos
          </p>
        </div>
        <Link
          href={`/${clubSlug}/catalogo/menu`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ListOrdered className="size-4" />
          Menú de precios
        </Link>
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
