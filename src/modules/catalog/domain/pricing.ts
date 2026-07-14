// Cálculo de precios del catálogo. Todo en enteros: cost/price en centavos,
// marginPct en % ×100 (ej. 35,50% -> 3550), rounding en centavos.

/// Precio base = costo × (1 + %/100), con % expresado ×100 (=> /10000).
export function computeBasePrice(costCents: number, marginPctX100: number): number {
  return Math.round(costCents * (1 + marginPctX100 / 10000));
}

/// Aplica redondeo hacia arriba al próximo múltiplo (en centavos). 0 = sin redondeo.
export function applyRounding(priceCents: number, roundingCents: number): number {
  if (!roundingCents || roundingCents <= 0) return priceCents;
  return Math.ceil(priceCents / roundingCents) * roundingCents;
}

/// Precio de venta calculado (base + redondeo).
export function computePrice(
  costCents: number,
  marginPctX100: number,
  roundingCents: number,
): number {
  return applyRounding(computeBasePrice(costCents, marginPctX100), roundingCents);
}

/// % de ganancia real (×100) a partir de costo y precio finales.
export function realMarginPct(costCents: number, priceCents: number): number {
  if (costCents <= 0) return 0;
  return Math.round(((priceCents - costCents) / costCents) * 10000);
}
