import type { PaymentStatus } from "./types";

export function derivePairPaymentStatus(
  player1PaymentStatus: PaymentStatus,
  player2PaymentStatus: PaymentStatus,
  hasPlayer2 = true,
): PaymentStatus {
  if (!hasPlayer2) {
    return player1PaymentStatus;
  }
  if (player1PaymentStatus === "PAID" && player2PaymentStatus === "PAID") {
    return "PAID";
  }
  if (player1PaymentStatus === "PAID" || player2PaymentStatus === "PAID") {
    return "PARTIAL";
  }
  return "UNPAID";
}
