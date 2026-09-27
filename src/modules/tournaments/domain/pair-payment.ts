import {
  PAIR_PAYMENT_METHODS,
  type PairPaymentMethod,
  type PaymentStatus,
} from "./types";

export {
  PAIR_PAYMENT_METHODS,
  PAIR_PAYMENT_METHOD_LABELS,
  type PairPaymentMethod,
} from "./types";

const PAIR_PAYMENT_METHOD_SET = new Set<string>(PAIR_PAYMENT_METHODS);

export function isPairPaymentMethod(
  value: string,
): value is PairPaymentMethod {
  return PAIR_PAYMENT_METHOD_SET.has(value);
}

/// Valores viejos del tilde (PAID) se leen como Efectivo.
export function parsePairPaymentMethod(
  value: string | null | undefined,
): PairPaymentMethod {
  if (value && isPairPaymentMethod(value)) return value;
  if (value === "PAID" || value === "PARTIAL") return "CASH";
  return "UNPAID";
}

export function pairPaymentIsPaid(method: PairPaymentMethod): boolean {
  return method !== "UNPAID";
}

/// Enum Prisma de inscripciones: solo UNPAID/PAID. La forma va en otra columna.
export function prismaPaidFromMethod(
  method: PairPaymentMethod,
): "UNPAID" | "PAID" {
  return pairPaymentIsPaid(method) ? "PAID" : "UNPAID";
}

export function derivePairPaymentStatus(
  player1PaymentStatus: string,
  player2PaymentStatus: string,
  hasPlayer2 = true,
): PaymentStatus {
  const player1Paid = pairPaymentIsPaid(
    parsePairPaymentMethod(player1PaymentStatus),
  );
  if (!hasPlayer2) return player1Paid ? "PAID" : "UNPAID";
  const player2Paid = pairPaymentIsPaid(
    parsePairPaymentMethod(player2PaymentStatus),
  );
  if (player1Paid && player2Paid) return "PAID";
  if (player1Paid || player2Paid) return "PARTIAL";
  return "UNPAID";
}
