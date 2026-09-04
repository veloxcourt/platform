"use server";

import { revalidatePath } from "next/cache";

import { requireClubModuleAccess } from "@/lib/auth/access";
import { createTournament } from "@/modules/tournaments/application/create-tournament";
import { cloneTournament } from "@/modules/tournaments/application/clone-tournament";
import { deleteTournament } from "@/modules/tournaments/application/delete-tournament";
import { updateTournament } from "@/modules/tournaments/application/update-tournament";
import {
  cloneTournamentNameSchema,
  createTournamentSchema,
  updateTournamentSchema,
  type CreateTournamentValues,
  type UpdateTournamentValues,
} from "@/modules/tournaments/domain/tournament-schema";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";
import { pesosToCents } from "@/lib/money";

type Result = { ok: true; id: string } | { ok: false; error: string };
type UpdateResult = { ok: true } | { ok: false; error: string };

type CreateTournamentInput = Omit<CreateTournamentValues, "fee"> & {
  feePesos?: number;
};

type UpdateTournamentInput = Omit<UpdateTournamentValues, "fee"> & {
  feePesos?: number;
};

async function resolveClubId(clubSlug: string) {
  await requireClubModuleAccess(clubSlug, "torneos");
  const repo = getTournamentRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, clubId: club?.id ?? null };
}

function revalidate(clubSlug: string, tournamentId?: string) {
  revalidatePath(`/${clubSlug}/torneos`);
  if (tournamentId) {
    revalidatePath(`/${clubSlug}/torneos/${tournamentId}`);
  }
}

export async function createTournamentAction(
  clubSlug: string,
  values: CreateTournamentInput,
): Promise<Result> {
  const { feePesos, ...rest } = values;
  const parsed = createTournamentSchema.safeParse({
    ...rest,
    fee: feePesos != null ? pesosToCents(feePesos) : 0,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await createTournament(repo, clubId, parsed.data);
  revalidate(clubSlug, result.id);
  return { ok: true, id: result.id };
}

export async function updateTournamentAction(
  clubSlug: string,
  tournamentId: string,
  values: UpdateTournamentInput,
): Promise<UpdateResult> {
  const { feePesos, ...rest } = values;
  const parsed = updateTournamentSchema.safeParse({
    ...rest,
    fee: feePesos != null ? pesosToCents(feePesos) : 0,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await updateTournament(
    repo,
    clubId,
    tournamentId,
    parsed.data,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "Error" };
}

export async function cloneTournamentAction(
  clubSlug: string,
  tournamentId: string,
  includePairs: boolean,
  name: string,
): Promise<Result> {
  const parsed = cloneTournamentNameSchema.safeParse({ name });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ingresá el nombre del torneo",
    };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await cloneTournament(
    repo,
    clubId,
    tournamentId,
    includePairs,
    parsed.data.name,
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidate(clubSlug, result.id);
  return { ok: true, id: result.id };
}

export async function deleteTournamentAction(
  clubSlug: string,
  tournamentId: string,
): Promise<UpdateResult> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await deleteTournament(repo, clubId, tournamentId);
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "Error" };
}
