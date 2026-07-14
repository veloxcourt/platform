"use server";

import { revalidatePath } from "next/cache";

import {
  cloneEcoItems,
  cloneSimulationName,
  defaultEcoItems,
  nextSimulationName,
} from "@/modules/herramientas/domain/eco-torneo";
import {
  ecoItemsSchema,
  ecoSimulationNameSchema,
} from "@/modules/herramientas/domain/eco-torneo-schema";
import { getHerramientasRepository } from "@/modules/herramientas/infrastructure/repository";

type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function resolveClub(clubSlug: string) {
  const repo = getHerramientasRepository();
  const club = await repo.getClubBySlug(clubSlug);
  return { repo, club };
}

function revalidateEco(clubSlug: string) {
  revalidatePath(`/${clubSlug}/herramientas/eco-torneo`);
  revalidatePath(`/${clubSlug}/herramientas`);
}

export async function createSimulationAction(
  clubSlug: string,
): Promise<Result<{ id: string }>> {
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const list = await repo.listEcoTorneoSimulations(club.id);
  const name = nextSimulationName(list.map((s) => s.name));
  const created = await repo.createEcoTorneoSimulation(club.id, {
    name,
    items: defaultEcoItems(),
  });
  revalidateEco(clubSlug);
  return { ok: true, data: { id: created.id } };
}

export async function cloneSimulationAction(
  clubSlug: string,
  sourceId: string,
): Promise<Result<{ id: string }>> {
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const source = await repo.getEcoTorneoSimulation(club.id, sourceId);
  if (!source) return { ok: false, error: "Simulación no encontrada" };

  const created = await repo.createEcoTorneoSimulation(club.id, {
    name: cloneSimulationName(source.name),
    items: cloneEcoItems(source.items),
  });
  revalidateEco(clubSlug);
  return { ok: true, data: { id: created.id } };
}

export async function deleteSimulationAction(
  clubSlug: string,
  id: string,
): Promise<Result<{ nextId: string | null }>> {
  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const deleted = await repo.deleteEcoTorneoSimulation(club.id, id);
  if (!deleted) return { ok: false, error: "Simulación no encontrada" };

  const remaining = await repo.listEcoTorneoSimulations(club.id);
  revalidateEco(clubSlug);
  return { ok: true, data: { nextId: remaining[0]?.id ?? null } };
}

export async function renameSimulationAction(
  clubSlug: string,
  id: string,
  name: string,
): Promise<Result> {
  const parsed = ecoSimulationNameSchema.safeParse(name);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Nombre inválido",
    };
  }

  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const updated = await repo.updateEcoTorneoSimulationName(
    club.id,
    id,
    parsed.data,
  );
  if (!updated) return { ok: false, error: "Simulación no encontrada" };

  revalidateEco(clubSlug);
  return { ok: true, data: undefined };
}

export async function saveSimulationItemsAction(
  clubSlug: string,
  id: string,
  items: unknown,
): Promise<Result> {
  const parsed = ecoItemsSchema.safeParse(items);
  if (!parsed.success) {
    return { ok: false, error: "Datos de planilla inválidos" };
  }

  const { repo, club } = await resolveClub(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const updated = await repo.updateEcoTorneoSimulationItems(
    club.id,
    id,
    parsed.data,
  );
  if (!updated) return { ok: false, error: "Simulación no encontrada" };

  return { ok: true, data: undefined };
}
