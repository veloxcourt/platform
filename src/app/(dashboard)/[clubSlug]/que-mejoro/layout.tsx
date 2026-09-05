import { enforceClubModulePage } from "@/lib/auth/access";

export default async function QueMejoroLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  await enforceClubModulePage(clubSlug, "que-mejoro");
  return children;
}
