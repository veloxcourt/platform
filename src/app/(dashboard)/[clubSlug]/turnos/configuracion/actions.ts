"use server";

import { revalidatePath } from "next/cache";

import { getBookingRepository } from "@/modules/bookings/infrastructure/repository";
import {
  turnosConfigSchema,
  type TurnosConfigValues,
} from "@/modules/bookings/domain/settings-schema";
import { saveClubCategories } from "@/modules/bookings/application/get-turnos-config";

export type SaveConfigResult =
  | { ok: true }
  | { ok: false; error: string };

/// Server Action: guarda la configuración de Turnos de un club
/// (parámetros + canchas) y revalida las vistas afectadas.
export async function saveTurnosConfig(
  clubSlug: string,
  values: TurnosConfigValues,
): Promise<SaveConfigResult> {
  const parsed = turnosConfigSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Datos de configuración inválidos" };
  }

  const repo = getBookingRepository();
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) {
    return { ok: false, error: "Club no encontrado" };
  }

  await repo.updateSettings(club.id, parsed.data.settings);
  await repo.saveCourts(club.id, parsed.data.courts);

  revalidatePath(`/${clubSlug}/turnos`);
  revalidatePath(`/${clubSlug}/turnos/configuracion`);

  return { ok: true };
}

/// Server Action: guarda las categorías de jugadores del club.
export async function saveCategoriesAction(
  clubSlug: string,
  categories: string[],
): Promise<SaveConfigResult> {
  const repo = getBookingRepository();
  const result = await saveClubCategories(repo, clubSlug, categories);
  if (result.ok) {
    revalidatePath(`/${clubSlug}/turnos`);
    revalidatePath(`/${clubSlug}/turnos/configuracion`);
  }
  return result;
}
