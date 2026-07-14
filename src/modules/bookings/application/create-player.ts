import type { BookingRepository } from "./booking-repository";
import type { NewPlayerValues } from "../domain/new-player-schema";
import type { PlayerRef } from "../domain/types";

export type CreatePlayerResult =
  | { ok: true; player: PlayerRef }
  | { ok: false; error: string };

/// Caso de uso: da de alta un jugador/cliente en el club.
export async function createPlayer(
  repo: BookingRepository,
  clubSlug: string,
  input: NewPlayerValues,
): Promise<CreatePlayerResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  const player = await repo.createPlayer(club.id, input);
  return { ok: true, player };
}

export type PlayerProfileResult =
  | { ok: true; profile: NewPlayerValues }
  | { ok: false; error: string };

/// Caso de uso: obtiene la ficha completa de un jugador.
export async function getPlayerProfile(
  repo: BookingRepository,
  clubSlug: string,
  userId: string,
): Promise<PlayerProfileResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const profile = await repo.getPlayerProfile(club.id, userId);
  if (!profile) return { ok: false, error: "Jugador no encontrado" };
  return { ok: true, profile };
}

/// Caso de uso: actualiza la ficha de un jugador.
export async function updatePlayer(
  repo: BookingRepository,
  clubSlug: string,
  userId: string,
  input: NewPlayerValues,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  await repo.updatePlayer(club.id, userId, input);
  return { ok: true };
}

/// Caso de uso: elimina un jugador del club.
export async function deletePlayer(
  repo: BookingRepository,
  clubSlug: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const result = await repo.deletePlayer(club.id, userId);
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "No se pudo eliminar" };
}
