import { enforceClubModulePage } from "@/lib/auth/access";

export default async function PlayersLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  await enforceClubModulePage(clubSlug, "jugadores");
  return children;
}
