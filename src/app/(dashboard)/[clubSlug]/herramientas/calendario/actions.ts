"use server";

import { revalidatePath } from "next/cache";

import { requireClubModuleAccess } from "@/lib/auth/access";
import {
  calendarCategorySchema,
  calendarSearchLinkSchema,
  calendarSettingsSchema,
  calendarVenueOrderSchema,
  calendarVenueSchema,
  plannedTournamentSchema,
} from "@/modules/herramientas/domain/calendario-schema";
import type {
  CalendarClub,
  CalendarPlannerSettings,
  CalendarSearchLink,
  CatalogCategory,
  PlannedTournament,
} from "@/modules/herramientas/domain/calendario-torneos";
import { getHerramientasRepository } from "@/modules/herramientas/infrastructure/repository";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function isRepoError<T extends { id: string }>(
  value: T | { error: string } | null,
): value is { error: string } {
  return !!value && "error" in value && !("id" in value);
}

async function resolveClub(clubSlug: string) {
  await requireClubModuleAccess(clubSlug, "calendario");
  const repo = getHerramientasRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, club };
}

function revalidateCalendario(clubSlug: string) {
  revalidatePath(`/${clubSlug}/herramientas/calendario`);
  revalidatePath(`/${clubSlug}/herramientas`);
}

export async function createCalendarVenueAction(
  clubSlug: string,
  values: unknown,
): Promise<Result<CalendarClub>> {
  const parsed = calendarVenueSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const created = await repo.createCalendarVenue(club.id, parsed.data);
  revalidateCalendario(clubSlug);
  return { ok: true, data: created };
}

export async function updateCalendarVenueAction(
  clubSlug: string,
  id: string,
  values: unknown,
): Promise<Result<CalendarClub>> {
  const parsed = calendarVenueSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const updated = await repo.updateCalendarVenue(club.id, id, parsed.data);
  if (!updated) return { ok: false, error: "Club no encontrado" };
  revalidateCalendario(clubSlug);
  return { ok: true, data: updated };
}

export async function deleteCalendarVenueAction(
  clubSlug: string,
  id: string,
): Promise<Result<undefined>> {
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const deleted = await repo.deleteCalendarVenue(club.id, id);
  if (!deleted) return { ok: false, error: "Club no encontrado" };
  revalidateCalendario(clubSlug);
  return { ok: true, data: undefined };
}

export async function reorderCalendarVenuesAction(
  clubSlug: string,
  ids: unknown,
): Promise<Result<undefined>> {
  const parsed = calendarVenueOrderSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: "Orden inválido" };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const ok = await repo.reorderCalendarVenues(club.id, parsed.data);
  if (!ok) return { ok: false, error: "No se pudo guardar el orden" };
  revalidateCalendario(clubSlug);
  return { ok: true, data: undefined };
}

export async function createCalendarCategoryAction(
  clubSlug: string,
  values: unknown,
): Promise<Result<CatalogCategory>> {
  const parsed = calendarCategorySchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const created = await repo.createCalendarCategory(club.id, parsed.data);
  if (isRepoError(created)) return { ok: false, error: created.error };
  revalidateCalendario(clubSlug);
  return { ok: true, data: created };
}

export async function updateCalendarCategoryAction(
  clubSlug: string,
  id: string,
  values: unknown,
): Promise<Result<CatalogCategory>> {
  const parsed = calendarCategorySchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const updated = await repo.updateCalendarCategory(club.id, id, parsed.data);
  if (!updated) return { ok: false, error: "Categoría no encontrada" };
  if (isRepoError(updated)) return { ok: false, error: updated.error };
  revalidateCalendario(clubSlug);
  return { ok: true, data: updated };
}

export async function deleteCalendarCategoryAction(
  clubSlug: string,
  id: string,
): Promise<Result<undefined>> {
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const deleted = await repo.deleteCalendarCategory(club.id, id);
  if (!deleted) return { ok: false, error: "Categoría no encontrada" };
  revalidateCalendario(clubSlug);
  return { ok: true, data: undefined };
}

export async function createPlannedTournamentAction(
  clubSlug: string,
  values: unknown,
): Promise<Result<PlannedTournament>> {
  const parsed = plannedTournamentSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const created = await repo.createPlannedTournament(club.id, parsed.data);
  if (isRepoError(created)) return { ok: false, error: created.error };
  revalidateCalendario(clubSlug);
  return { ok: true, data: created };
}

export async function updatePlannedTournamentAction(
  clubSlug: string,
  id: string,
  values: unknown,
): Promise<Result<PlannedTournament>> {
  const parsed = plannedTournamentSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const updated = await repo.updatePlannedTournament(club.id, id, parsed.data);
  if (!updated) return { ok: false, error: "Torneo no encontrado" };
  if (isRepoError(updated)) return { ok: false, error: updated.error };
  revalidateCalendario(clubSlug);
  return { ok: true, data: updated };
}

export async function deletePlannedTournamentAction(
  clubSlug: string,
  id: string,
): Promise<Result<undefined>> {
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const deleted = await repo.deletePlannedTournament(club.id, id);
  if (!deleted) return { ok: false, error: "Torneo no encontrado" };
  revalidateCalendario(clubSlug);
  return { ok: true, data: undefined };
}

export async function createCalendarSearchLinkAction(
  clubSlug: string,
  values: unknown,
): Promise<Result<CalendarSearchLink>> {
  const parsed = calendarSearchLinkSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const created = await repo.createCalendarSearchLink(club.id, parsed.data);
  revalidateCalendario(clubSlug);
  return { ok: true, data: created };
}

export async function updateCalendarSearchLinkAction(
  clubSlug: string,
  id: string,
  values: unknown,
): Promise<Result<CalendarSearchLink>> {
  const parsed = calendarSearchLinkSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const updated = await repo.updateCalendarSearchLink(
    club.id,
    id,
    parsed.data,
  );
  if (!updated) return { ok: false, error: "Sitio no encontrado" };
  revalidateCalendario(clubSlug);
  return { ok: true, data: updated };
}

export async function deleteCalendarSearchLinkAction(
  clubSlug: string,
  id: string,
): Promise<Result<undefined>> {
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const deleted = await repo.deleteCalendarSearchLink(club.id, id);
  if (!deleted) return { ok: false, error: "Sitio no encontrado" };
  revalidateCalendario(clubSlug);
  return { ok: true, data: undefined };
}

export async function updateCalendarSettingsAction(
  clubSlug: string,
  values: unknown,
): Promise<Result<CalendarPlannerSettings>> {
  const parsed = calendarSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const settings = await repo.updateCalendarPlannerSettings(
    club.id,
    parsed.data,
  );
  revalidateCalendario(clubSlug);
  return { ok: true, data: settings };
}
