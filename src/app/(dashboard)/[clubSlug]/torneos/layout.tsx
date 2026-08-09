import { enforceClubModulePage } from "@/lib/auth/access";

export default async function TournamentsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  await enforceClubModulePage(clubSlug, "torneos");
  return children;
}
