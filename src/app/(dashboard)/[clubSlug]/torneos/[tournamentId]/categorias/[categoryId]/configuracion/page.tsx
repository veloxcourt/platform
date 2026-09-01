import { redirect } from "next/navigation";

import {
  parseTournamentMode,
  withTournamentMode,
} from "@/lib/tournament-mode";

export default async function CategoriaConfiguracionRedirect({
  params,
  searchParams,
}: {
  params: Promise<{
    clubSlug: string;
    tournamentId: string;
    categoryId: string;
  }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { clubSlug, tournamentId } = await params;
  const { modo } = await searchParams;
  redirect(
    withTournamentMode(
      `/${clubSlug}/torneos/${tournamentId}/configuracion`,
      parseTournamentMode(modo),
    ),
  );
}
