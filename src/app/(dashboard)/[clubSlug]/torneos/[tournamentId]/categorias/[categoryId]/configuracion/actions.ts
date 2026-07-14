"use server";

import { revalidatePath } from "next/cache";

import { tournamentConfigSchema } from "@/modules/tournaments/domain/config-schema";
import type { TournamentConfigValues } from "@/modules/tournaments/domain/config-schema";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

type Result = { ok: true } | { ok: false; error: string };

async function resolveClubId(clubSlug: string) {
  const repo = getTournamentRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, clubId: club?.id ?? null };
}

function revalidate(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
) {
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}`);
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}/categorias`);
  revalidatePath(
    `/${clubSlug}/torneos/${tournamentId}/categorias/${categoryId}/configuracion`,
  );
}

export async function saveCategoryConfigAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
  values: TournamentConfigValues,
): Promise<Result> {
  const parsed = tournamentConfigSchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.saveTournamentConfig(
    clubId,
    tournamentId,
    parsed.data,
  );
  if (result.ok) revalidate(clubSlug, tournamentId, categoryId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}
