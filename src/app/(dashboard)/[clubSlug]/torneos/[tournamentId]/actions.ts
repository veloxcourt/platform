"use server";

import { revalidatePath } from "next/cache";

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
import { getTournamentRepository } from "@/modules/tournaments/infrastructure/repository";

type Result = { ok: true } | { ok: false; error: string };
type AddPairResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function resolveClubId(clubSlug: string) {
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

  revalidate(clubSlug, tournamentId);
  const matchCount = result.fixture.zones.reduce(
    (sum, zone) => sum + zone.matches.length,
    0,
  );
  return {
    ok: true,
    warnings: result.fixture.warnings,
    zoneCount: result.fixture.zones.length,
    matchCount,
  };
}

export async function getZonasTournamentDetailAction(
  clubSlug: string,
  tournamentId: string,
) {
  const repo = getTournamentRepository();
  return getZonasTournamentDetail(repo, clubSlug, tournamentId);
}
