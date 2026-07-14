import { redirect } from "next/navigation";

export default async function CategoriaConfiguracionRedirect({
  params,
}: {
  params: Promise<{
    clubSlug: string;
    tournamentId: string;
    categoryId: string;
  }>;
}) {
  const { clubSlug, tournamentId } = await params;
  redirect(`/${clubSlug}/torneos/${tournamentId}/configuracion`);
}
