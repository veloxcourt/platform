import type { RegistrationStatus } from "./types";

export function derivePairRegistrationStatus(
  currentStatus: RegistrationStatus,
  player2Id: string | null,
  player1Confirmed: boolean,
  player2Confirmed: boolean,
): RegistrationStatus {
  if (currentStatus === "CANCELLED") return "CANCELLED";
  if (!player2Id) return "PENDING";
  if (player1Confirmed && player2Confirmed) return "CONFIRMED";
  return "PENDING";
}

export function isPairComplete(player2Id: string | null): boolean {
  return player2Id !== null;
}
