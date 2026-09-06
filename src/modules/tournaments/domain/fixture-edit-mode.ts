export const FIXTURE_EDIT_MODE_VALUES = ["AUTO", "MANUAL"] as const;

export type FixtureEditMode = (typeof FIXTURE_EDIT_MODE_VALUES)[number];

export const FIXTURE_EDIT_PHASES = ["zones", "intermediate", "final"] as const;

export type FixtureEditPhase = (typeof FIXTURE_EDIT_PHASES)[number];

/// AUTO/MANUAL por categoría. La misma variable vale en Zonas, Intermedia y Final.
export type FixtureEditModes = Record<string, FixtureEditMode>;

export const FIXTURE_EDIT_MODE_LABELS: Record<FixtureEditMode, string> = {
  AUTO: "Modo Automático",
  MANUAL: "Modo Manual",
};

export const DEFAULT_FIXTURE_EDIT_MODES: FixtureEditModes = {};

const PHASE_KEYS = new Set<string>(FIXTURE_EDIT_PHASES);

export function parseFixtureEditMode(value: unknown): FixtureEditMode {
  return value === "MANUAL" ? "MANUAL" : "AUTO";
}

export function fixtureEditModeForCategory(
  modes: FixtureEditModes | null | undefined,
  categoryId: string | null | undefined,
): FixtureEditMode {
  if (!categoryId) return "AUTO";
  return parseFixtureEditMode(modes?.[categoryId]);
}

export function isCategoryManual(
  modes: FixtureEditModes | null | undefined,
  categoryId: string | null | undefined,
): boolean {
  return fixtureEditModeForCategory(modes, categoryId) === "MANUAL";
}

function isPhaseShapedMap(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => PHASE_KEYS.has(key));
}

function legacyModeFrom(value: unknown, legacy?: unknown): FixtureEditMode {
  if (value === "AUTO" || value === "MANUAL") return value;
  if (isPhaseShapedMap(value)) {
    return parseFixtureEditMode(
      (value as Record<string, unknown>).zones ??
        (value as Record<string, unknown>).intermediate ??
        (value as Record<string, unknown>).final,
    );
  }
  return parseFixtureEditMode(legacy);
}

export function parseFixtureEditModes(
  value: unknown,
  categoryIds: string[] = [],
  legacy?: unknown,
): FixtureEditModes {
  const fallback = legacyModeFrom(value, legacy);
  const source =
    value && typeof value === "object" && !Array.isArray(value) && !isPhaseShapedMap(value)
      ? (value as Record<string, unknown>)
      : {};
  const result: FixtureEditModes = {};
  const ids =
    categoryIds.length > 0
      ? categoryIds
      : Object.keys(source).filter((key) => !PHASE_KEYS.has(key));
  for (const id of ids) {
    result[id] = parseFixtureEditMode(source[id] ?? fallback);
  }
  return result;
}

export type ActualizarConfirmScope = "all" | "category";

export type ActualizarConfirmCopy = {
  title: string;
  affects: string[];
  doesNotAffect: string[];
};

export type ActualizarConfirmCategory = { id: string; name: string };

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function splitByMode(
  categories: ActualizarConfirmCategory[],
  modes: FixtureEditModes,
) {
  const auto: ActualizarConfirmCategory[] = [];
  const manual: ActualizarConfirmCategory[] = [];
  for (const category of categories) {
    if (isCategoryManual(modes, category.id)) manual.push(category);
    else auto.push(category);
  }
  return { auto, manual };
}

export function buildActualizarConfirmCopy(params: {
  phase: FixtureEditPhase;
  scope: ActualizarConfirmScope;
  modes: FixtureEditModes;
  categories: ActualizarConfirmCategory[];
  categoryId?: string;
}): ActualizarConfirmCopy {
  const { phase, scope, modes, categories, categoryId } = params;
  const current = categories.find((item) => item.id === categoryId);
  const { auto, manual } = splitByMode(categories, modes);
  const autoNames = joinNames(auto.map((item) => item.name));
  const manualNames = joinNames(manual.map((item) => item.name));
  const affects: string[] = [];
  const doesNotAffect: string[] = [];

  if (scope === "category") {
    const name = current?.name ?? "esta categoría";
    const categoryManual = isCategoryManual(modes, categoryId);
    if (phase === "zones") {
      if (categoryManual) {
        affects.push(
          `Ajusta las tarjetas de ${name} al formato de zonas de 3 o de 4.`,
        );
        affects.push(
          "Conserva las parejas de las zonas que no hace falta tocar.",
        );
        affects.push(
          "Solo mueve lo necesario para pasar de 3 a 4 o de 4 a 3.",
        );
        doesNotAffect.push("No cambia día, horario ni cancha.");
        doesNotAffect.push("Seguís en Modo Manual para seguir editando.");
        doesNotAffect.push(
          `No toca la fase intermedia ni la fase final de ${name}.`,
        );
      } else {
        affects.push(
          `Rearma las zonas de ${name}: parejas, día, horario y cancha.`,
        );
        affects.push(
          `También rearma la fase intermedia y la fase final de ${name}.`,
        );
      }
    } else if (phase === "intermediate") {
      affects.push(`Rearma la intermedia de ${name}: día, horario y cancha.`);
      affects.push(`También rearma la fase final de ${name}.`);
      doesNotAffect.push(`No toca las zonas de ${name}.`);
    } else {
      affects.push(`Rearma la fase final de ${name}: día, horario y cancha.`);
      doesNotAffect.push(`No toca las zonas de ${name}.`);
      doesNotAffect.push(`No toca la fase intermedia de ${name}.`);
    }
    doesNotAffect.push("No toca las otras categorías.");
    doesNotAffect.push("No borra los resultados ya cargados.");
    return {
      title: `¿Actualizar ${name}?`,
      affects,
      doesNotAffect,
    };
  }

  if (phase === "zones") {
    affects.push(
      autoNames
        ? `Rearma las zonas de ${autoNames}: parejas, día, horario y cancha.`
        : "No hay categorías en Modo Automático para rearmar.",
    );
    if (auto.length > 0) {
      affects.push(
        `También rearma la intermedia y la final de ${autoNames}.`,
      );
    }
  } else if (phase === "intermediate") {
    affects.push(
      autoNames
        ? `Rearma la intermedia de ${autoNames}: día, horario y cancha.`
        : "No hay categorías en Modo Automático para rearmar.",
    );
    if (auto.length > 0) {
      affects.push(`También rearma la fase final de ${autoNames}.`);
    }
    doesNotAffect.push("No toca las zonas.");
  } else {
    affects.push(
      autoNames
        ? `Rearma la fase final de ${autoNames}: día, horario y cancha.`
        : "No hay categorías en Modo Automático para rearmar.",
    );
    doesNotAffect.push("No toca las zonas.");
    doesNotAffect.push("No toca la fase intermedia.");
  }
  if (manual.length > 0) {
    doesNotAffect.push(
      `No toca ${manualNames}: ${manual.length === 1 ? "está" : "están"} en Modo Manual.`,
    );
  }
  doesNotAffect.push("No borra los resultados ya cargados.");
  doesNotAffect.push("No cambia el modo de cada categoría.");

  const phaseTitle =
    phase === "zones"
      ? "las zonas"
      : phase === "intermediate"
        ? "la fase intermedia"
        : "la fase final";
  return {
    title: `¿Actualizar ${phaseTitle} de las categorías en Automático?`,
    affects,
    doesNotAffect,
  };
}
