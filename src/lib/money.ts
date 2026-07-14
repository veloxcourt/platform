// Utilidades de dinero. Criterio de la plataforma: todo se guarda en CENTAVOS
// (entero ×100). Se convierte y formatea solo al mostrar.

/// Pesos (posiblemente con decimales) -> centavos enteros.
export function pesosToCents(pesos: number): number {
  return Math.round((Number.isFinite(pesos) ? pesos : 0) * 100);
}

/// Centavos -> pesos (número, para inputs).
export function centsToPesos(cents: number): number {
  return (cents ?? 0) / 100;
}

/// Formatea centavos como moneda. `decimals` define cuántos decimales mostrar.
export function formatMoney(
  cents: number,
  currency = "ARS",
  decimals = 0,
): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format((cents ?? 0) / 100);
}

// Porcentaje: se guarda ×100 (ej. 35,50% -> 3550).
export function pctToStore(pct: number): number {
  return Math.round((Number.isFinite(pct) ? pct : 0) * 100);
}

export function storeToPct(stored: number): number {
  return (stored ?? 0) / 100;
}
