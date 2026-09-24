import type { RegistrationStatus } from "./types";

export type PairConfirmationDisplayState =
  | "cancelled"
  | "cancel_requested"
  | "incomplete"
  | "pending"
  | "partial"
  | "confirmed";

export function derivePairRegistrationStatus(
  currentStatus: RegistrationStatus,
  player2Id: string | null,
  player1Confirmed: boolean,
  player2Confirmed: boolean,
): RegistrationStatus {
  if (currentStatus === "CANCELLED") return "CANCELLED";
  if (currentStatus === "CANCEL_REQUESTED") return "CANCEL_REQUESTED";
  if (!player2Id) return "PENDING";
  if (player1Confirmed && player2Confirmed) return "CONFIRMED";
  return "PENDING";
}

export function pairConfirmationDisplayState(input: {
  status: RegistrationStatus;
  hasPartner: boolean;
  player1Confirmed: boolean;
  player2Confirmed: boolean;
}): PairConfirmationDisplayState {
  if (input.status === "CANCELLED") return "cancelled";
  if (input.status === "CANCEL_REQUESTED") return "cancel_requested";
  if (!input.hasPartner) return "incomplete";
  if (input.player1Confirmed && input.player2Confirmed) return "confirmed";
  if (input.player1Confirmed || input.player2Confirmed) return "partial";
  return "pending";
}

/** La pareja sigue en el torneo hasta que el Club confirme la baja. */
export function isPairActiveStatus(status: RegistrationStatus): boolean {
  return status !== "CANCELLED";
}

export function isPairEligibleForZones(input: {
  status: RegistrationStatus;
  hasPartner: boolean;
  player1Confirmed: boolean;
  player2Confirmed: boolean;
}): boolean {
  const state = pairConfirmationDisplayState(input);
  return state === "partial" || state === "confirmed";
}

export function isPairComplete(player2Id: string | null): boolean {
  return player2Id !== null;
}
