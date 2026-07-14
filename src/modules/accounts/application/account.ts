import type { BookingRepository } from "@/modules/bookings/application/booking-repository";
import type { PlayerAccount } from "../domain/types";
import type { AddMovementValues } from "../domain/movement-schema";

export type AccountResult =
  | { ok: true; account: PlayerAccount }
  | { ok: false; error: string };

export type CommandResult = { ok: true } | { ok: false; error: string };

/// Caso de uso: obtiene la cuenta corriente de un jugador (saldo + movimientos).
export async function getPlayerAccount(
  repo: BookingRepository,
  clubSlug: string,
  userId: string,
): Promise<AccountResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };
  const account = await repo.getPlayerAccount(club.id, userId);
  return { ok: true, account };
}

/// Caso de uso: registra un movimiento (compra o pago) en la cuenta del jugador.
export async function addMovement(
  repo: BookingRepository,
  clubSlug: string,
  userId: string,
  values: AddMovementValues,
): Promise<CommandResult> {
  const club = await repo.getClubBySlug(clubSlug);
  if (!club) return { ok: false, error: "Club no encontrado" };

  await repo.addAccountMovement(club.id, userId, {
    type: values.type,
    amount: values.amount,
    concept: values.concept ? values.concept : undefined,
    method: values.method ? values.method : undefined,
  });
  return { ok: true };
}
