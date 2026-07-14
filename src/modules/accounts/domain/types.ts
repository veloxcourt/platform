// Dominio de la cuenta corriente del jugador/cliente.

export type MovementType = "CHARGE" | "PAYMENT";
export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
};

export interface AccountMovement {
  id: string;
  type: MovementType;
  amount: number; // unidades enteras de la moneda
  concept: string | null;
  method: PaymentMethod | null;
  createdAt: string; // ISO
}

/// Cuenta de un jugador: saldo (deuda si es positivo) + últimos movimientos.
export interface PlayerAccount {
  balance: number;
  movements: AccountMovement[];
}

/// Datos para registrar un movimiento (ya validados).
export interface AddMovementData {
  type: MovementType;
  amount: number;
  concept?: string;
  method?: PaymentMethod;
  // Snapshot de venta (cuando el movimiento proviene de vender un producto)
  productId?: string;
  quantity?: number;
  unitPrice?: number;
}
