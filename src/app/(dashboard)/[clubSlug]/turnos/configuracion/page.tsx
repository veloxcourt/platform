import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getClubAccess } from "@/lib/auth/access";
import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import { getTurnosConfig } from "@/modules/bookings/application/get-turnos-config";
import { SettingsForm } from "@/components/features/turnos/settings-form";
import { CategoriesEditor } from "@/components/features/turnos/categories-editor";
import { WhatsAppTestPanel } from "@/components/features/notifications/whatsapp-test-panel";
import { getPlayersList } from "@/modules/bookings/application/get-players-list";

export const metadata = {
  title: "Configuración de Turnos · VeloxCourt",
};

export default async function ConfiguracionTurnosPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const access = await getClubAccess(clubSlug);
  if (!access?.allowedModules.includes("turnos-config")) {
    redirect(`/${clubSlug}/turnos`);
  }

  const repo = getBookingRepository();
  const config = await getTurnosConfig(repo, clubSlug);
  if (!config) notFound();

  const products = await repo.getSellableProducts(config.club.id);
  const playersData = await getPlayersList(repo, clubSlug);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href={`/${clubSlug}/turnos`}
        className="sticky top-0 z-10 -mb-3 flex items-center gap-1 bg-background py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Volver al calendario
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Configuración de Turnos</h1>
        <p className="text-sm text-muted-foreground">{config.club.name}</p>
      </div>

      <SettingsForm
        clubSlug={clubSlug}
        initialSettings={config.settings}
        initialCourts={config.courts}
        products={products}
        currency={config.club.currency}
      />

      <CategoriesEditor
        clubSlug={clubSlug}
        initialCategories={config.categories}
      />

      <WhatsAppTestPanel
        clubSlug={clubSlug}
        clubName={config.club.name}
        players={playersData?.players ?? []}
      />
    </div>
  );
}
