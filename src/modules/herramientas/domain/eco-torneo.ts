/// Eco-Torneo: planilla de costos e ingresos de un torneo.
/// Montos en centavos (mismo criterio de la plataforma).

export type EcoFlowType = "ENTRADA" | "SALIDA";

export const ECO_ENTRADA_CATEGORIES = [
  "INSCRIPCIONES",
  "SPONSOR",
] as const;

export const ECO_SALIDA_CATEGORIES = [
  "PREMIOS_PLATA",
  "REMUNERACION_AYUDANTE",
  "USO_CANCHAS",
  "PELOTAS",
  "PERSONAL_BAR",
  "GASTO_GENERAL",
] as const;

export type EcoEntradaCategory = (typeof ECO_ENTRADA_CATEGORIES)[number];
export type EcoSalidaCategory = (typeof ECO_SALIDA_CATEGORIES)[number];
export type EcoCategory = EcoEntradaCategory | EcoSalidaCategory;

/** Categorías cuyo % se resta para obtener el resto de USO CANCHAS. */
export const ECO_PCT_RESERVADO_CATEGORIES: readonly EcoSalidaCategory[] = [
  "PREMIOS_PLATA",
  "REMUNERACION_AYUDANTE",
];

export type EcoFormulaKind =
  | "cantidad_x_valor"
  | "valor"
  | "pct_inscripciones"
  /** % = 100 − Premios plata − Remuneración ayudante, sobre insc. */
  | "resto_pct_inscripciones";

export type EcoCategoryDef = {
  key: EcoCategory;
  label: string;
  flow: EcoFlowType;
  formula: EcoFormulaKind;
  /** Etiqueta del campo unitario (Valor / Valor tubo). */
  valorLabel?: string;
  /** Si el ítem entra en el saldo al crearlo. */
  defaultEnSaldo?: boolean;
};

export const ECO_CATEGORY_DEFS: Record<EcoCategory, EcoCategoryDef> = {
  INSCRIPCIONES: {
    key: "INSCRIPCIONES",
    label: "Inscripciones",
    flow: "ENTRADA",
    formula: "cantidad_x_valor",
    valorLabel: "Valor",
  },
  SPONSOR: {
    key: "SPONSOR",
    label: "Sponsor",
    flow: "ENTRADA",
    formula: "valor",
    valorLabel: "Valor",
  },
  PREMIOS_PLATA: {
    key: "PREMIOS_PLATA",
    label: "Premios plata",
    flow: "SALIDA",
    formula: "pct_inscripciones",
  },
  REMUNERACION_AYUDANTE: {
    key: "REMUNERACION_AYUDANTE",
    label: "Remuneración ayudante",
    flow: "SALIDA",
    formula: "pct_inscripciones",
  },
  USO_CANCHAS: {
    key: "USO_CANCHAS",
    label: "Uso canchas",
    flow: "SALIDA",
    formula: "resto_pct_inscripciones",
    defaultEnSaldo: false,
  },
  PELOTAS: {
    key: "PELOTAS",
    label: "Pelotas",
    flow: "SALIDA",
    formula: "cantidad_x_valor",
    valorLabel: "Valor tubo",
  },
  PERSONAL_BAR: {
    key: "PERSONAL_BAR",
    label: "Personal Bar",
    flow: "SALIDA",
    formula: "cantidad_x_valor",
    valorLabel: "Costo hora",
  },
  GASTO_GENERAL: {
    key: "GASTO_GENERAL",
    label: "Gasto general",
    flow: "SALIDA",
    formula: "cantidad_x_valor",
    valorLabel: "Costo",
  },
};

export type EcoItem = {
  id: string;
  category: EcoCategory;
  observacion: string;
  /** Jugadores / tubos / unidades. */
  cantidad: number | null;
  /** Precio unitario o monto (sponsor), en centavos. */
  valorCents: number | null;
  /** Porcentaje 0–100 (premios / ayudante). */
  porcentaje: number | null;
  /** Si false, el importe se muestra pero no entra en totales/saldo. */
  enSaldo: boolean;
};

export type EcoLineAmounts = {
  debeCents: number;
  haberCents: number;
};

export function flowForCategory(category: EcoCategory): EcoFlowType {
  return ECO_CATEGORY_DEFS[category].flow;
}

export function categoriesForFlow(flow: EcoFlowType): EcoCategory[] {
  return flow === "ENTRADA"
    ? [...ECO_ENTRADA_CATEGORIES]
    : [...ECO_SALIDA_CATEGORIES];
}

export function createEcoItem(
  category: EcoCategory,
  partial?: Partial<Omit<EcoItem, "id" | "category">>,
): EcoItem {
  const def = ECO_CATEGORY_DEFS[category];
  return {
    id: crypto.randomUUID(),
    category,
    observacion: partial?.observacion ?? "",
    cantidad: partial?.cantidad ?? null,
    valorCents: partial?.valorCents ?? null,
    porcentaje: partial?.porcentaje ?? null,
    enSaldo: partial?.enSaldo ?? def.defaultEnSaldo ?? true,
  };
}

export function totalInscripcionesCents(items: EcoItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.category !== "INSCRIPCIONES") continue;
    const qty = item.cantidad ?? 0;
    const valor = item.valorCents ?? 0;
    total += qty * valor;
  }
  return total;
}

export function sumPorcentajesReservados(items: EcoItem[]): number {
  let sum = 0;
  for (const item of items) {
    if (
      !(ECO_PCT_RESERVADO_CATEGORIES as readonly string[]).includes(
        item.category,
      )
    ) {
      continue;
    }
    sum += item.porcentaje ?? 0;
  }
  return sum;
}

/** % de USO CANCHAS = 100 − Premios plata − Remuneración ayudante. */
export function usoCanchasPct(items: EcoItem[]): number {
  return 100 - sumPorcentajesReservados(items);
}

export function computeItemAmounts(
  item: EcoItem,
  inscripcionesTotalCents: number,
  restoPct: number,
): EcoLineAmounts {
  const def = ECO_CATEGORY_DEFS[item.category];
  let amount = 0;

  switch (def.formula) {
    case "cantidad_x_valor":
      amount = (item.cantidad ?? 0) * (item.valorCents ?? 0);
      break;
    case "valor":
      amount = item.valorCents ?? 0;
      break;
    case "pct_inscripciones":
      amount = Math.round(
        ((item.porcentaje ?? 0) / 100) * inscripcionesTotalCents,
      );
      break;
    case "resto_pct_inscripciones":
      amount = Math.round((restoPct / 100) * inscripcionesTotalCents);
      break;
  }

  if (def.flow === "ENTRADA") {
    return { debeCents: amount, haberCents: 0 };
  }
  return { debeCents: 0, haberCents: amount };
}

export function computePlanilla(items: EcoItem[]) {
  const inscripcionesTotalCents = totalInscripcionesCents(items);
  const restoPct = usoCanchasPct(items);
  const lines = items.map((item) => ({
    item,
    restoPct:
      ECO_CATEGORY_DEFS[item.category].formula === "resto_pct_inscripciones"
        ? restoPct
        : null,
    ...computeItemAmounts(item, inscripcionesTotalCents, restoPct),
  }));

  const totalDebeCents = lines.reduce(
    (sum, l) => sum + (l.item.enSaldo !== false ? l.debeCents : 0),
    0,
  );
  const totalHaberCents = lines.reduce(
    (sum, l) => sum + (l.item.enSaldo !== false ? l.haberCents : 0),
    0,
  );

  return {
    lines,
    inscripcionesTotalCents,
    restoPct,
    totalDebeCents,
    totalHaberCents,
    saldoCents: totalDebeCents - totalHaberCents,
  };
}
