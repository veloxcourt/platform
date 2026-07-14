import type { BookingRepository } from "./booking-repository";
import type { BookingSettings, ClubInfo, Court } from "../domain/types";
import { normalizeCategoryLevel } from "@/modules/tournaments/domain/category-level";

export interface TurnosConfig {
  club: ClubInfo;
  settings: BookingSettings;
  courts: Court[];
  categories: string[];
}

/// Caso de uso: carga la configuración de Turnos de un club (parámetros + canchas + categorías).
export async function getTurnosConfig(
  repo: BookingRepository,
  clubSlug: string,
): Promise<TurnosConfig | null> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return null;

  const [settings, courts, categories] = await Promise.all([
    repo.getSettings(club.id),
    repo.getCourts(club.id),
    repo.getClubCategories(club.id),
  ]);

  return { club, settings, courts, categories };
}

/// Caso de uso: guarda las categorías de jugadores del club.
export async function saveClubCategories(
  repo: BookingRepository,
  clubSlug: string,
  categories: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const cleaned = Array.from(
    new Set(
      categories
        .map((c) => normalizeCategoryLevel(c.trim()))
        .filter(Boolean),
    ),
  );
  await repo.saveCategories(club.id, cleaned);
  return { ok: true };
}
