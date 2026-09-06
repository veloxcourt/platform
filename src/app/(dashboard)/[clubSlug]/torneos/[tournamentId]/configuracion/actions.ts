"use server";

import { revalidatePath } from "next/cache";

import { requireClubModuleAccess } from "@/lib/auth/access";
import {
  playDaySchema,
  tournamentConfigSchema,
} from "@/modules/tournaments/domain/config-schema";
import type {
  PlayDayValues,
  TournamentConfigValues,
} from "@/modules/tournaments/domain/config-schema";
import { defaultRoundConfigs } from "@/modules/tournaments/domain/config-defaults";
import { toPlayDayValues } from "@/modules/tournaments/domain/play-day-slots";
import type { TournamentConfig } from "@/modules/tournaments/domain/types";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

type Result = { ok: true } | { ok: false; error: string };

async function resolveClubId(clubSlug: string) {
  await requireClubModuleAccess(clubSlug, "torneos");
  const repo = getTournamentRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, clubId: club?.id ?? null };
}

function revalidate(clubSlug: string, tournamentId: string) {
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}`);
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}/configuracion`);
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}/categorias`);
}

export async function saveTournamentConfigAction(
  clubSlug: string,
  tournamentId: string,
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
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

function toConfigValues(
  config: TournamentConfig,
  playDays: PlayDayValues[],
): TournamentConfigValues {
  return {
    courtCount: config.courtCount,
    playDays: playDays.map((day) => toPlayDayValues(day)),
    categories: config.categories.map((category) => ({
      categoryId: category.categoryId,
      phases: {
        zones: {
          matchFormat: category.phases.zones.matchFormat,
          matchDurationMin: category.phases.zones.matchDurationMin,
          playDates: category.phases.zones.playDates ?? [],
        },
        knockout: {
          matchFormat: category.phases.knockout.matchFormat,
          matchDurationMin: category.phases.knockout.matchDurationMin,
          playDates: category.phases.knockout.playDates ?? [],
        },
        final: {
          matchFormat: category.phases.final.matchFormat,
          matchDurationMin: category.phases.final.matchDurationMin,
          playDates: category.phases.final.playDates ?? [],
          startsAtRound: category.phases.final.startsAtRound,
        },
      },
      rounds: defaultRoundConfigs(
        category.phases.final.startsAtRound,
        category.phases.knockout,
        category.phases.final,
        category.rounds,
      ),
      intervalMin: category.intervalMin,
      pairsPerZone: category.pairsPerZone ?? 3,
      zone4Advancers: category.zone4Advancers === 2 ? 2 : 3,
    })),
  };
}

/// Actualiza solo los días de juego (misma info que Parámetros / simulación).
export async function updatePlayDaysAction(
  clubSlug: string,
  tournamentId: string,
  playDays: PlayDayValues[],
): Promise<Result> {
  const parsed = playDaySchema.array().min(1).safeParse(playDays);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const config = await repo.getTournamentConfig(clubId, tournamentId);
  if (!config) return { ok: false, error: "Configuración no encontrada" };

  const result = await repo.saveTournamentConfig(
    clubId,
    tournamentId,
    toConfigValues(config, parsed.data),
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function copyCategoryPhaseConfigAction(
  clubSlug: string,
  tournamentId: string,
  sourceCategoryId: string,
  targetCategoryId: string,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.copyCategoryPhaseConfig(
    clubId,
    tournamentId,
    sourceCategoryId,
    targetCategoryId,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}
