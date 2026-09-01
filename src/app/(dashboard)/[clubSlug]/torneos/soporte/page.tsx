import { TorneosHubShell } from "@/components/features/torneos/torneos-hub-shell";
import { TorneosSoporteView } from "@/components/features/torneos/torneos-soporte-view";

export const metadata = {
  title: "Soporte · Torneos · VeloxCourt",
};

export default async function TorneosSoportePage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;

  return (
    <TorneosHubShell
      clubSlug={clubSlug}
      subtitle="Cómo se conforma cada llave según la cantidad de parejas"
    >
      <TorneosSoporteView />
    </TorneosHubShell>
  );
}
