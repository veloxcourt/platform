"use server";

import { revalidatePath } from "next/cache";

import { requireClubModuleAccess } from "@/lib/auth/access";
import { getZonasTournamentDetail } from "@/modules/tournaments/application/get-zonas-tournament-detail";
import { addPairSchema, updatePairSchema } from "@/modules/tournaments/domain/pair-schema";
import type { AddPairValues, UpdatePairValues } from "@/modules/tournaments/domain/pair-schema";
import {
  togglePairSlotSchema,
  type TogglePairSlotValues,
  replacePairSlotPreferencesSchema,
  type ReplacePairSlotPreferencesValues,
} from "@/modules/tournaments/domain/slot-reservation-schema";
import {
  updatePairZonesDayPreferenceSchema,
  type UpdatePairZonesDayPreferenceValues,
} from "@/modules/tournaments/domain/zones-day-preference";
import type {
  PaymentStatus,
  RegistrationStatus,
} from "@/modules/tournaments/domain/types";
import { intermediateFixtureSchema } from "@/modules/tournaments/domain/intermediate-fixture-schema";
import { zonesFixtureDraftSchema } from "@/modules/tournaments/domain/zones-fixture-schema";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

type Result = { ok: true } | { ok: false; error: string };
type AddPairResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function resolveClubId(clubSlug: string) {
  await requireClubModuleAccess(clubSlug, "torneos");
  const repo = getTournamentRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, clubId: club?.id ?? null };
}

function revalidate(clubSlug: string, tournamentId: string) {
  revalidatePath(`/${clubSlug}/torneos`);
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}`);
}

export async function addPairAction(
  clubSlug: string,
  tournamentId: string,
  values: AddPairValues,
): Promise<AddPairResult> {
  const parsed = addPairSchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.addPair(clubId, tournamentId, parsed.data);
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok
    ? { ok: true, id: result.id }
    : { ok: false, error: result.error ?? "Error" };
}

export async function updatePairAction(
  clubSlug: string,
  tournamentId: string,
  pairId: string,
  values: UpdatePairValues,
): Promise<Result> {
  const parsed = updatePairSchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.updatePair(
    clubId,
    tournamentId,
    pairId,
    parsed.data,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function updatePairStatusAction(
  clubSlug: string,
  tournamentId: string,
  pairId: string,
  status: RegistrationStatus,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.updatePairStatus(clubId, pairId, status);
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function updatePairPlayerPaymentAction(
  clubSlug: string,
  tournamentId: string,
  pairId: string,
  slot: 1 | 2,
  paymentStatus: PaymentStatus,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.updatePairPlayerPayment(
    clubId,
    pairId,
    slot,
    paymentStatus,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function updatePairPlayerConfirmationAction(
  clubSlug: string,
  tournamentId: string,
  pairId: string,
  slot: 1 | 2,
  confirmed: boolean,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.updatePairPlayerConfirmation(
    clubId,
    pairId,
    slot,
    confirmed,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function updatePairZonesDayPreferenceAction(
  clubSlug: string,
  tournamentId: string,
  pairId: string,
  values: UpdatePairZonesDayPreferenceValues,
): Promise<Result> {
  const parsed = updatePairZonesDayPreferenceSchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.updatePairZonesDayPreference(
    clubId,
    tournamentId,
    pairId,
    parsed.data.zonesDayPreference,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function togglePairSlotAction(
  clubSlug: string,
  tournamentId: string,
  pairId: string,
  values: TogglePairSlotValues,
): Promise<Result> {
  const parsed = togglePairSlotSchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.togglePairSlotReservation(
    clubId,
    tournamentId,
    pairId,
    parsed.data,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function replacePairSlotPreferencesAction(
  clubSlug: string,
  tournamentId: string,
  pairId: string,
  values: ReplacePairSlotPreferencesValues,
): Promise<Result> {
  const parsed = replacePairSlotPreferencesSchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.replacePairSlotPreferences(
    clubId,
    tournamentId,
    pairId,
    parsed.data,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function buildZonesFixtureAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
): Promise<
  | { ok: true; warnings: string[]; zoneCount: number; matchCount: number }
  | { ok: false; error: string }
> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.buildAndSaveZonesFixture(
    clubId,
    tournamentId,
    categoryId,
  );
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Error" };
  }

  const warnings = [...result.fixture.warnings];
  const intermediate = await repo.buildAndSaveIntermediateFixture(
    clubId,
    tournamentId,
  );
  if (!intermediate.ok) {
    const skip =
      intermediate.error ===
      "Ninguna categoría tiene fase intermedia para armar";
    if (!skip && intermediate.error) {
      warnings.push(`Intermedia: ${intermediate.error}`);
    }
  } else {
    warnings.push(...intermediate.warnings);
  }

  const finalPhase = await repo.buildAndSaveFinalFixture(clubId, tournamentId);
  if (!finalPhase.ok) {
    const skip =
      finalPhase.error === "Ninguna categoría tiene fase final para armar" ||
      finalPhase.error === "Esta categoría no tiene fase final para armar";
    if (!skip && finalPhase.error) {
      warnings.push(`Final: ${finalPhase.error}`);
    }
  } else {
    warnings.push(...finalPhase.warnings);
  }

  revalidate(clubSlug, tournamentId);
  const matchCount = result.fixture.zones.reduce(
    (sum, zone) => sum + zone.matches.length,
    0,
  );
  return {
    ok: true,
    warnings,
    zoneCount: result.fixture.zones.length,
    matchCount,
  };
}

export async function buildAllZonesFixturesAction(
  clubSlug: string,
  tournamentId: string,
): Promise<
  | {
      ok: true;
      warnings: string[];
      categoryCount: number;
      zoneCount: number;
      matchCount: number;
    }
  | { ok: false; error: string }
> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const config = await repo.getTournamentConfig(clubId, tournamentId);
  if (!config) return { ok: false, error: "Configuración no encontrada" };
  if (config.categories.length === 0) {
    return { ok: false, error: "No hay categorías para armar" };
  }

  const warnings: string[] = [];
  let zoneCount = 0;
  let matchCount = 0;
  let okCategories = 0;

  for (const category of config.categories) {
    const result = await repo.buildAndSaveZonesFixture(
      clubId,
      tournamentId,
      category.categoryId,
    );
    if (!result.ok) {
      warnings.push(
        `${category.categoryName}: ${result.error ?? "Error"}`,
      );
      continue;
    }
    okCategories += 1;
    zoneCount += result.fixture.zones.length;
    matchCount += result.fixture.zones.reduce(
      (sum, zone) => sum + zone.matches.length,
      0,
    );
    for (const warning of result.fixture.warnings) {
      warnings.push(`${category.categoryName}: ${warning}`);
    }
  }

  if (okCategories === 0) {
    return {
      ok: false,
      error: warnings[0] ?? "No se pudieron armar las zonas",
    };
  }

  const intermediate = await repo.buildAndSaveIntermediateFixture(
    clubId,
    tournamentId,
  );
  if (!intermediate.ok) {
    const skip =
      intermediate.error ===
      "Ninguna categoría tiene fase intermedia para armar";
    if (!skip && intermediate.error) {
      warnings.push(`Intermedia: ${intermediate.error}`);
    }
  } else {
    warnings.push(...intermediate.warnings);
  }

  const finalPhase = await repo.buildAndSaveFinalFixture(clubId, tournamentId);
  if (!finalPhase.ok) {
    const skip =
      finalPhase.error === "Ninguna categoría tiene fase final para armar" ||
      finalPhase.error === "Esta categoría no tiene fase final para armar";
    if (!skip && finalPhase.error) {
      warnings.push(`Final: ${finalPhase.error}`);
    }
  } else {
    warnings.push(...finalPhase.warnings);
  }

  revalidate(clubSlug, tournamentId);
  return {
    ok: true,
    warnings,
    categoryCount: okCategories,
    zoneCount,
    matchCount,
  };
}

export async function buildIntermediateFixtureAction(
  clubSlug: string,
  tournamentId: string,
  categoryId?: string,
): Promise<
  | {
      ok: true;
      warnings: string[];
      categoryCount: number;
      matchCount: number;
    }
  | { ok: false; error: string }
> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.buildAndSaveIntermediateFixture(
    clubId,
    tournamentId,
    categoryId,
  );
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Error" };
  }

  const warnings = [...result.warnings];
  const finalPhase = await repo.buildAndSaveFinalFixture(
    clubId,
    tournamentId,
    categoryId,
  );
  if (!finalPhase.ok) {
    const skip =
      finalPhase.error === "Ninguna categoría tiene fase final para armar" ||
      finalPhase.error === "Esta categoría no tiene fase final para armar";
    if (!skip && finalPhase.error) {
      warnings.push(`Final: ${finalPhase.error}`);
    }
  } else {
    warnings.push(...finalPhase.warnings);
  }

  revalidate(clubSlug, tournamentId);
  return { ...result, warnings };
}

export async function buildFinalFixtureAction(
  clubSlug: string,
  tournamentId: string,
  categoryId?: string,
): Promise<
  | {
      ok: true;
      warnings: string[];
      categoryCount: number;
      matchCount: number;
    }
  | { ok: false; error: string }
> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.buildAndSaveFinalFixture(
    clubId,
    tournamentId,
    categoryId,
  );
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Error" };
  }

  revalidate(clubSlug, tournamentId);
  return result;
}

export async function setFixtureEditModeAction(
  clubSlug: string,
  tournamentId: string,
  mode: "AUTO" | "MANUAL",
): Promise<Result> {
  if (mode !== "AUTO" && mode !== "MANUAL") {
    return { ok: false, error: "Modo inválido" };
  }
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.setFixtureEditMode(clubId, tournamentId, mode);
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function saveZonesFixtureDraftAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
  draft: unknown,
): Promise<Result> {
  const parsed = zonesFixtureDraftSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, error: "Datos de zonas inválidos" };
  }
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.saveZonesFixtureDraft(
    clubId,
    tournamentId,
    categoryId,
    parsed.data,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function saveKnockoutFixtureDraftAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
  phase: "intermediate" | "final",
  fixture: unknown,
): Promise<Result> {
  if (phase !== "intermediate" && phase !== "final") {
    return { ok: false, error: "Fase inválida" };
  }
  const parsed = intermediateFixtureSchema.safeParse(fixture);
  if (!parsed.success) {
    return { ok: false, error: "Datos de fixture inválidos" };
  }
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.saveKnockoutFixtureDraft(
    clubId,
    tournamentId,
    categoryId,
    phase,
    parsed.data,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Error" };
}

export async function calculateZoneQualificationAction(
  clubSlug: string,
  tournamentId: string,
): Promise<
  | {
      ok: true;
      categoryCount: number;
      seedCount: number;
      warnings: string[];
    }
  | { ok: false; error: string }
> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.calculateAndSaveZoneQualification(
    clubId,
    tournamentId,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result;
}

export async function getZonasTournamentDetailAction(
  clubSlug: string,
  tournamentId: string,
) {
  const repo = getTournamentRepository();
  return getZonasTournamentDetail(repo, clubSlug, tournamentId);
}
