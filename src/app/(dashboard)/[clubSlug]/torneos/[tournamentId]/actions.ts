"use server";

import { revalidatePath } from "next/cache";

import { requireClubModuleAccess } from "@/lib/auth/access";
import { getZonasTournamentDetail } from "@/modules/tournaments/application/get-zonas-tournament-detail";
import { ensurePairManagePath } from "@/modules/tournaments/application/find-public-pair";
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
  PairPaymentMethod,
  RegistrationStatus,
} from "@/modules/tournaments/domain/types";
import { isPairPaymentMethod } from "@/modules/tournaments/domain/pair-payment";
import { intermediateFixtureSchema } from "@/modules/tournaments/domain/intermediate-fixture-schema";
import { zonesFixtureDraftSchema } from "@/modules/tournaments/domain/zones-fixture-schema";
import {
  findZoneScoreLosses,
  type ZoneScoreLoss,
} from "@/modules/tournaments/domain/zones-score-loss";
import { armadoProLayoutSchema } from "@/modules/tournaments/domain/armado-pro";
import {
  isPhaseManual,
  type FixtureEditMode,
  type FixtureEditPhase,
} from "@/modules/tournaments/domain/fixture-edit-mode";
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";
import type {
  SaveZonesArmadoProResult,
  TournamentRepository,
} from "@/modules/tournaments/application/tournament-repository";

type Result = { ok: true } | { ok: false; error: string };
type AddPairResult =
  | {
      ok: true;
      id: string;
      /// La pareja quedó creada pero no se guardaron sus preferencias.
      warning?: { title: string; description: string };
    }
  | { ok: false; error: string };

const addPairPreferencesSchema = replacePairSlotPreferencesSchema.extend(
  updatePairZonesDayPreferenceSchema.shape,
);
type AddPairPreferences = ReplacePairSlotPreferencesValues &
  UpdatePairZonesDayPreferenceValues;

async function resolveClubId(clubSlug: string) {
  const access = await requireClubModuleAccess(clubSlug, "torneos");
  return { repo: getTournamentRepository(), clubId: access.club.id };
}

function revalidate(clubSlug: string, tournamentId: string) {
  revalidatePath(`/${clubSlug}/torneos`);
  revalidatePath(`/${clubSlug}/torneos/${tournamentId}`);
}

async function rebuildDownstreamFixtures(
  repo: TournamentRepository,
  clubId: string,
  tournamentId: string,
  warnings: string[],
  options: {
    includeIntermediate?: boolean;
    categoryId?: string;
  } = {},
) {
  if (options.includeIntermediate) {
    const intermediate = await repo.buildAndSaveIntermediateFixture(
      clubId,
      tournamentId,
      options.categoryId,
    );
    if (!intermediate.ok) {
      const skip =
        intermediate.error ===
          "Ninguna categoría tiene fase intermedia para armar" ||
        intermediate.error ===
          "Esta categoría no tiene fase intermedia para armar" ||
        intermediate.error ===
          "Ninguna categoría en Modo Automático tiene fase intermedia para armar";
      if (!skip && intermediate.error) {
        warnings.push(`Intermedia: ${intermediate.error}`);
      }
    } else {
      warnings.push(...intermediate.warnings);
    }
  }

  const finalPhase = await repo.buildAndSaveFinalFixture(
    clubId,
    tournamentId,
    options.categoryId,
  );
  if (!finalPhase.ok) {
    const skip =
      finalPhase.error === "Ninguna categoría tiene fase final para armar" ||
      finalPhase.error === "Esta categoría no tiene fase final para armar" ||
      finalPhase.error ===
        "Ninguna categoría en Modo Automático tiene fase final para armar";
    if (!skip && finalPhase.error) {
      warnings.push(`Final: ${finalPhase.error}`);
    }
  } else {
    warnings.push(...finalPhase.warnings);
  }
}

export async function addPairAction(
  clubSlug: string,
  tournamentId: string,
  values: AddPairValues,
  preferences: AddPairPreferences = { slots: [], zonesDayPreference: "ANY" },
): Promise<AddPairResult> {
  const parsed = addPairSchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }
  const parsedPreferences = addPairPreferencesSchema.safeParse(preferences);
  if (!parsedPreferences.success) {
    const msg = parsedPreferences.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.addPair(clubId, tournamentId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error ?? "Error" };

  revalidate(clubSlug, tournamentId);
  const { slots, zonesDayPreference } = parsedPreferences.data;

  if (slots.length > 0) {
    const saved = await repo.replacePairSlotPreferences(
      clubId,
      tournamentId,
      result.id,
      { slots },
    );
    if (!saved.ok) {
      return {
        ok: true,
        id: result.id,
        warning: {
          title: "Inscripción creada, pero no se guardaron las preferencias",
          description: saved.error ?? "Error",
        },
      };
    }
  }

  if (zonesDayPreference !== "ANY") {
    const saved = await repo.updatePairZonesDayPreference(
      clubId,
      tournamentId,
      result.id,
      zonesDayPreference,
    );
    if (!saved.ok) {
      return {
        ok: true,
        id: result.id,
        warning: {
          title: "Inscripción creada, pero no se guardó la preferencia de días",
          description: saved.error ?? "Error",
        },
      };
    }
  }

  return { ok: true, id: result.id };
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
  method: PairPaymentMethod,
): Promise<Result> {
  if (!isPairPaymentMethod(method)) {
    return { ok: false, error: "Forma de pago inválida" };
  }
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.updatePairPlayerPayment(
    clubId,
    pairId,
    slot,
    method,
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

export async function setPairsConfirmationAction(
  clubSlug: string,
  tournamentId: string,
  pairIds: string[],
  confirmed: boolean,
): Promise<Result> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const result = await repo.setPairsConfirmation(
    clubId,
    tournamentId,
    pairIds,
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
  const modes = await repo.getFixtureEditModes(clubId, tournamentId);
  if (!isPhaseManual(modes, categoryId, "zones")) {
    await rebuildDownstreamFixtures(repo, clubId, tournamentId, warnings, {
      includeIntermediate: true,
      categoryId: result.saved.length > 1 ? undefined : categoryId,
    });
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

/// Arma las zonas sin guardar y devuelve qué resultados cargados se perderían.
/// Sin `categoryId` revisa el Actualizar de todas las categorías.
export async function previewZonesScoreLossAction(
  clubSlug: string,
  tournamentId: string,
  categoryId?: string,
): Promise<
  | {
      ok: true;
      categories: Array<{
        categoryId: string;
        categoryName: string;
        zones: ZoneScoreLoss[];
      }>;
    }
  | { ok: false; error: string }
> {
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const config = await repo.getTournamentConfig(clubId, tournamentId);
  if (!config) return { ok: false, error: "Configuración no encontrada" };

  const result = await repo.buildAndSaveZonesFixture(
    clubId,
    tournamentId,
    categoryId,
    { dryRun: true },
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Error" };

  const categories = result.saved.flatMap((item) => {
    const previous = config.categories.find(
      (category) => category.categoryId === item.categoryId,
    )?.zonesFixture;
    const zones = findZoneScoreLosses(previous, item.fixture);
    return zones.length > 0
      ? [{ categoryId: item.categoryId, categoryName: item.categoryName, zones }]
      : [];
  });
  return { ok: true, categories };
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

  const modes = await repo.getFixtureEditModes(clubId, tournamentId);
  const warnings: string[] = [];
  for (const category of config.categories) {
    if (isPhaseManual(modes, category.categoryId, "zones")) {
      warnings.push(`${category.categoryName}: no se rearmó (Modo Manual)`);
    }
  }

  const result = await repo.buildAndSaveZonesFixture(clubId, tournamentId);
  if (!result.ok) {
    return { ok: false, error: result.error ?? "No se pudieron armar las zonas" };
  }

  let zoneCount = 0;
  let matchCount = 0;
  for (const item of result.saved) {
    zoneCount += item.fixture.zones.length;
    matchCount += item.fixture.zones.reduce(
      (sum, zone) => sum + zone.matches.length,
      0,
    );
    for (const warning of item.fixture.warnings) {
      warnings.push(`${item.categoryName}: ${warning}`);
    }
  }

  if (result.saved.length === 0) {
    return {
      ok: false,
      error: warnings[0] ?? "No se pudieron armar las zonas",
    };
  }

  await rebuildDownstreamFixtures(repo, clubId, tournamentId, warnings, {
    includeIntermediate: true,
  });

  revalidate(clubSlug, tournamentId);
  return {
    ok: true,
    warnings,
    categoryCount: result.saved.length,
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
  await rebuildDownstreamFixtures(repo, clubId, tournamentId, warnings, {
    categoryId,
  });

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
  categoryId: string,
  mode: FixtureEditMode,
  phase: FixtureEditPhase,
): Promise<Result> {
  if (!categoryId) {
    return { ok: false, error: "Categoría inválida" };
  }
  if (mode !== "AUTO" && mode !== "MANUAL") {
    return { ok: false, error: "Modo inválido" };
  }
  if (phase !== "zones" && phase !== "intermediate" && phase !== "final") {
    return { ok: false, error: "Fase inválida" };
  }
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.setFixtureEditMode(
    clubId,
    tournamentId,
    categoryId,
    mode,
    phase,
  );
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

export async function saveZonesArmadoProAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
  layout: unknown,
): Promise<SaveZonesArmadoProResult> {
  const parsed = armadoProLayoutSchema.safeParse(layout);
  if (!parsed.success) {
    return { ok: false, error: "Datos de Armado Pro inválidos" };
  }
  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  const result = await repo.saveZonesArmadoPro(
    clubId,
    tournamentId,
    categoryId,
    parsed.data,
  );
  if (result.ok) revalidate(clubSlug, tournamentId);
  return result;
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
  categoryId?: string,
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
    categoryId,
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

export async function getPairManageLinkAction(
  clubSlug: string,
  tournamentId: string,
  pairId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };
  return ensurePairManagePath(clubId, tournamentId, pairId);
}
