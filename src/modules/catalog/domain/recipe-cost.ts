// Costo de receta: proporciona el costo del simple a la cantidad usada en el plato.
// Montos en centavos. Cantidades en la misma unidad del producto componente.

export type RecipeCostLine = {
  componentCostCents: number;
  componentBaseQty: number;
  recipeQty: number;
};

/// Costo de una línea: (qtyReceta / baseQty) × costoDelSimple.
export function lineCostCents(
  componentCostCents: number,
  componentBaseQty: number,
  recipeQty: number,
): number {
  if (!(componentBaseQty > 0) || !(recipeQty >= 0)) return 0;
  return Math.round((recipeQty / componentBaseQty) * componentCostCents);
}

/// Costo total de la receta (suma de líneas).
export function totalRecipeCostCents(lines: RecipeCostLine[]): number {
  return lines.reduce(
    (sum, line) =>
      sum +
      lineCostCents(
        line.componentCostCents,
        line.componentBaseQty,
        line.recipeQty,
      ),
    0,
  );
}
