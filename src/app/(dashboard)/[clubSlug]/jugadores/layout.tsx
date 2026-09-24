import { enforceClubModulePage } from "@/lib/auth/access";
import { JugadoresSubnav } from "@/components/features/players/jugadores-subnav";

export default async function PlayersLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  await enforceClubModulePage(clubSlug, "jugadores");

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3">
        <h1 className="text-xl font-semibold">Jugadores</h1>
        <JugadoresSubnav clubSlug={clubSlug} />
      </div>
      {children}
    </div>
  );
}
