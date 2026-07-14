// Cantidades de venta. Se permiten fracciones (ej. una coca compartida entre 4:
// cada uno paga 1/4). Los presets cubren los casos más comunes; para el resto
// se ingresa la cantidad manualmente.

export interface QuantityPreset {
  label: string;
  value: number;
}

export const QUANTITY_PRESETS: QuantityPreset[] = [
  { label: "¼", value: 1 / 4 },
  { label: "⅓", value: 1 / 3 },
  { label: "½", value: 1 / 2 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
];

/// Compara dos cantidades tolerando el redondeo de fracciones como 1/3.
export function quantityEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

/// Etiqueta legible de una cantidad (usa la fracción del preset si coincide).
export function formatQuantity(qty: number): string {
  const preset = QUANTITY_PRESETS.find((p) => quantityEquals(p.value, qty));
  if (preset) return preset.label;
  return String(Number(qty.toFixed(3)));
}
