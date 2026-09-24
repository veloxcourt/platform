"use server";

import { revalidatePath } from "next/cache";

import { requireClubModuleAccess } from "@/lib/auth/access";
import { calendarCategorySchema } from "@/modules/herramientas/domain/calendario-schema";
import type { CalendarCategoryValues } from "@/modules/herramientas/domain/calendario-schema";
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
  revalidatePath(`/${clubSlug}/herramientas/calendario`);
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

export async function createCatalogAndAddCategoryAction(
  clubSlug: string,
  tournamentId: string,
  values: CalendarCategoryValues,
): Promise<Result> {
  const parsed = calendarCategorySchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const created = await repo.createCatalogCategory(clubId, parsed.data);
  if ("error" in created) return { ok: false, error: created.error };

  const result = await repo.createTournamentCategory(clubId, tournamentId, {
    catalogCategoryId: created.id,
  });
  if (result.ok) revalidateTournament(clubSlug, tournamentId);
  return result;
}

export async function updateCatalogCategoryAction(
  clubSlug: string,
  tournamentId: string,
  catalogCategoryId: string,
  values: CalendarCategoryValues,
): Promise<Result> {
  const parsed = calendarCategorySchema.safeParse(values);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return { ok: false, error: msg };
  }

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const updated = await repo.updateCatalogCategory(
    clubId,
    catalogCategoryId,
    parsed.data,
  );
  if (!updated) return { ok: false, error: "Categoría no encontrada" };
  if ("error" in updated) return { ok: false, error: updated.error };

  revalidateTournament(clubSlug, tournamentId);
  return { ok: true, id: updated.id };
}

function abbreviationFromName(name: string): string {
  const compact = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length >= 1) return compact.slice(0, 6);
  return "CAT";
}

function uniqueAbbreviation(desired: string, used: Set<string>): string {
  const base = desired.toUpperCase();
  if (!used.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 5)}${i}`.slice(0, 6);
    if (!used.has(candidate)) return candidate;
  }
  return base.slice(0, 6);
}

export async function updateCategoryColorAction(
  clubSlug: string,
  tournamentId: string,
  categoryId: string,
  color: string,
): Promise<Result> {
  const parsed = calendarCategorySchema
    .pick({ color: true })
    .safeParse({ color });
  if (!parsed.success) {
    return { ok: false, error: "Color inválido" };
  }
  const hex = parsed.data.color;

  const { repo, clubId } = await resolveClubId(clubSlug);
  if (!clubId) return { ok: false, error: "Club no encontrado" };

  const categories = await repo.listTournamentCategories(clubId, tournamentId);
  if (!categories) return { ok: false, error: "Torneo no encontrado" };
  const category = categories.find((row) => row.id === categoryId);
  if (!category) return { ok: false, error: "Categoría no encontrada" };

  const catalogList = await repo.listCatalogCategories(clubId);
  let catalogId = category.catalogCategoryId;

  if (!catalogId) {
    const byName = catalogList.find(
      (row) => row.name.toLowerCase() === category.name.toLowerCase(),
    );
    if (byName) {
      const linked = await repo.createTournamentCategory(clubId, tournamentId, {
        catalogCategoryId: byName.id,
      });
      if (!linked.ok) return linked;
      catalogId = byName.id;
    }
  }

  if (catalogId) {
    const catalog =
      catalogList.find((row) => row.id === catalogId) ??
      (await repo.listCatalogCategories(clubId)).find(
        (row) => row.id === catalogId,
      );
    if (!catalog) return { ok: false, error: "Categoría no encontrada" };

    const updated = await repo.updateCatalogCategory(clubId, catalogId, {
      name: catalog.name,
      abbreviation: catalog.abbreviation,
      color: hex,
    });
    if (!updated) return { ok: false, error: "Categoría no encontrada" };
    if ("error" in updated) return { ok: false, error: updated.error };

    revalidateTournament(clubSlug, tournamentId);
    return { ok: true, id: updated.id };
  }

  const used = new Set(
    catalogList.map((row) => row.abbreviation.toUpperCase()),
  );
  const abbreviation = uniqueAbbreviation(
    category.abbreviation?.trim() || abbreviationFromName(category.name),
    used,
  );
  const created = await repo.createCatalogCategory(clubId, {
    name: category.name,
    abbreviation,
    color: hex,
  });
  if ("error" in created) return { ok: false, error: created.error };

  const linked = await repo.createTournamentCategory(clubId, tournamentId, {
    catalogCategoryId: created.id,
  });
  if (linked.ok) revalidateTournament(clubSlug, tournamentId);
  return linked;
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
