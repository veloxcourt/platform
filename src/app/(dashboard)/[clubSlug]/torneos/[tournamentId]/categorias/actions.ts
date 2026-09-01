"use server";

import { revalidatePath } from "next/cache";

import { requireClubModuleAccess } from "@/lib/auth/access";
import {
  createCategorySchema,
  renameCategorySchema,
} from "@/modules/tournaments/domain/category-schema";
import type {
  CreateCategoryValues,
  RenameCategoryValues,
} from "@/modules/tournaments/domain/category-schema";
import { updateCategorySimulationSchema } from "@/modules/tournaments/domain/category-simulation-schema";
import type { UpdateCategorySimulationValues } from "@/modules/tournaments/domain/category-simulation-schema";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function resolveClubId(clubSlug: string) {
  await requireClubModuleAccess(clubSlug, "torneos");
  const repo = getTournamentRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, clubId: club?.id ?? null };
}

function revalidateTournament(clubSlug: string, tournamentId: string) {
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}`);
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}/categorias`);
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}/configuracion`);
}

export async function createCategoryAction(
  clubSlug: string,
  tournamentId: string,
  values: CreateCategoryValues,
): Promise<Result> {
  const parsed = createCategorySchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.createTournamentCategory(
    clubId,
    tournamentId,
    parsed.data,
  );
  if (result.ok) revalidateTournament(clubSlug, tournamentId);
  return result;
}

export async function renameCategoryAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
  values: RenameCategoryValues,
): Promise<Result> {
  const parsed = renameCategorySchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.renameTournamentCategory(
    clubId,
    tournamentId,
    categoryId,
    parsed.data,
  );
  if (result.ok) revalidateTournament(clubSlug, tournamentId);
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "Error" };
}

export async function deleteCategoryAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.deleteTournamentCategory(
    clubId,
    tournamentId,
    categoryId,
  );
  if (result.ok) revalidateTournament(clubSlug, tournamentId);
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "Error" };
}

export async function updateCategorySimulationAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
  values: UpdateCategorySimulationValues,
): Promise<Result> {
  const parsed = updateCategorySimulationSchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.updateCategorySimulation(
    clubId,
    tournamentId,
    categoryId,
    parsed.data,
  );
  if (result.ok) revalidateTournament(clubSlug, tournamentId);
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "Error" };
}
