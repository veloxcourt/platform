import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PriceMenu } from "@/components/features/catalog/price-menu";
import { getClubAccess, getCurrentUser } from "@/lib/auth/access";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}): Promise<Metadata> {
  const { clubSlug } = await params;
  const club = await getBookingRepository().getClubBySlug(clubSlug);
  return {
    title: club ? `Menú de precios · ${club.name}` : "Menú de precios · VeloxCourt",
  };
}

export default async function CleanPriceMenuPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const current = await getCurrentUser();
  if (!current) redirect(`/login?next=/menu-precios/${clubSlug}`);

  const access = await getClubAccess(clubSlug);
  const canSee =
    access?.allowedModules.includes("menu-precios") ||
    access?.allowedModules.includes("catalogo");
  if (!access || !canSee) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-2 px-4 py-10">
        <h1 className="text-xl font-semibold">Menú de precios</h1>
        <p className="text-sm text-muted-foreground">
          No tenés acceso a este menú.
        </p>
      </main>
    );
  }

  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) notFound();

  const [allProducts, allTypes] = await Promise.all([
    repo.listProducts(club.id),
    repo.listProductTypes(club.id),
  ]);
  const products = allProducts
    .filter((product) => product.active && product.showInPriceMenu)
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      photoUrl: product.photoUrl,
      typeId: product.typeId,
    }));
  const publishedTypeIds = new Set(
    products
      .map((product) => product.typeId)
      .filter((id): id is string => Boolean(id)),
  );
  const types = allTypes.filter((type) => publishedTypeIds.has(type.id));

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header>
        <p className="text-sm text-muted-foreground">Menú de precios</p>
        <h1 className="text-2xl font-semibold">{club.name}</h1>
      </header>
      <PriceMenu currency={club.currency} products={products} types={types} />
    </main>
  );
}
