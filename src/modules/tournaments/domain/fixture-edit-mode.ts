export const FIXTURE_EDIT_MODE_VALUES = ["AUTO", "MANUAL"] as const;

export type FixtureEditMode = (typeof FIXTURE_EDIT_MODE_VALUES)[number];

export const FIXTURE_EDIT_PHASES = ["zones", "intermediate", "final"] as const;

export type FixtureEditPhase = (typeof FIXTURE_EDIT_PHASES)[number];

export type CategoryFixtureEditModes = Record<FixtureEditPhase, FixtureEditMode>;

/// AUTO/MANUAL por categoría y por fase (Zonas, Intermedia y Final son independientes).
export type FixtureEditModes = Record<string, CategoryFixtureEditModes>;

export const FIXTURE_EDIT_MODE_LABELS: Record<FixtureEditMode, string> = {
  AUTO: "Modo Automático",
  MANUAL: "Modo Manual",
};

export const FIXTURE_EDIT_PHASE_LABELS: Record<FixtureEditPhase, string> = {
  zones: "Zonas",
  intermediate: "Fase Intermedia",
  final: "Fase Final",
};

export const DEFAULT_FIXTURE_EDIT_MODES: FixtureEditModes = {};

const PHASE_KEYS = new Set<string>(FIXTURE_EDIT_PHASES);

export function parseFixtureEditMode(value: unknown): FixtureEditMode {
  return value === "MANUAL" ? "MANUAL" : "AUTO";
}

export function emptyPhaseModes(
  fallback: FixtureEditMode = "AUTO",
): CategoryFixtureEditModes {
  return {
    zones: fallback,
    intermediate: fallback,
    final: fallback,
  };
}

export function fixtureEditModeFor(
  modes: FixtureEditModes | null | undefined,
  categoryId: string | null | undefined,
  phase: FixtureEditPhase,
): FixtureEditMode {
  if (!categoryId) return "AUTO";
  return parseFixtureEditMode(modes?.[categoryId]?.[phase]);
}

export function isPhaseManual(
  modes: FixtureEditModes | null | undefined,
  categoryId: string | null | undefined,
  phase: FixtureEditPhase,
): boolean {
  return fixtureEditModeFor(modes, categoryId, phase) === "MANUAL";
}

export function setCategoryPhaseMode(
  modes: FixtureEditModes,
  categoryId: string,
  phase: FixtureEditPhase,
  mode: FixtureEditMode,
): FixtureEditModes {
  const current = modes[categoryId] ?? emptyPhaseModes();
  return {
    ...modes,
    [categoryId]: { ...current, [phase]: mode },
  };
}

function isPhaseShapedMap(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => PHASE_KEYS.has(key));
}

function phaseModesFromUnknown(
  value: unknown,
  fallback: FixtureEditMode,
): CategoryFixtureEditModes {
  if (value === "AUTO" || value === "MANUAL") {
    return emptyPhaseModes(value);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    if ("zones" in rec || "intermediate" in rec || "final" in rec) {
      return {
        zones: parseFixtureEditMode(rec.zones ?? fallback),
        intermediate: parseFixtureEditMode(rec.intermediate ?? fallback),
        final: parseFixtureEditMode(rec.final ?? fallback),
      };
    }
  }
  return emptyPhaseModes(fallback);
}

function legacyFallback(value: unknown, legacy?: unknown): FixtureEditMode {
  if (value === "AUTO" || value === "MANUAL") return value;
  return parseFixtureEditMode(legacy);
}

export function parseFixtureEditModes(
  value: unknown,
  categoryIds: string[] = [],
  legacy?: unknown,
): FixtureEditModes {
  const fallback = legacyFallback(value, legacy);
  if (isPhaseShapedMap(value)) {
    const phases = phaseModesFromUnknown(value, fallback);
    const result: FixtureEditModes = {};
    for (const id of categoryIds) result[id] = { ...phases };
    return result;
  }
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const ids =
    categoryIds.length > 0
      ? categoryIds
      : Object.keys(source).filter((key) => !PHASE_KEYS.has(key));
  const result: FixtureEditModes = {};
  for (const id of ids) {
    result[id] = phaseModesFromUnknown(source[id], fallback);
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
  phase: FixtureEditPhase,
) {
  const auto: ActualizarConfirmCategory[] = [];
  const manual: ActualizarConfirmCategory[] = [];
  for (const category of categories) {
    if (isPhaseManual(modes, category.id, phase)) manual.push(category);
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
  const { auto, manual } = splitByMode(categories, modes, phase);
  const autoNames = joinNames(auto.map((item) => item.name));
  const manualNames = joinNames(manual.map((item) => item.name));
  const affects: string[] = [];
  const doesNotAffect: string[] = [];

  if (scope === "category") {
    const name = current?.name ?? "esta categoría";
    const categoryManual = isPhaseManual(modes, categoryId, phase);
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
        doesNotAffect.push("Seguís en Modo Manual en Zonas para seguir editando.");
        doesNotAffect.push(
          `No toca la fase intermedia ni la fase final de ${name}.`,
        );
      } else {
        affects.push(
          `Rearma las zonas de ${name}: parejas, día, horario y cancha.`,
        );
        affects.push(
          `También rearma la fase intermedia y la fase final de ${name} si esas fases están en Automático.`,
        );
      }
    } else if (phase === "intermediate") {
      affects.push(`Rearma la intermedia de ${name}: día, horario y cancha.`);
      affects.push(`También rearma la fase final de ${name} si está en Automático.`);
      doesNotAffect.push(`No toca las zonas de ${name}.`);
    } else {
      affects.push(`Rearma la fase final de ${name}: día, horario y cancha.`);
      doesNotAffect.push(`No toca las zonas de ${name}.`);
      doesNotAffect.push(`No toca la fase intermedia de ${name}.`);
    }
    doesNotAffect.push("No toca las otras categorías.");
    doesNotAffect.push("No borra los resultados ya cargados.");
    doesNotAffect.push("No cambia el modo de las otras pestañas.");
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
        `También rearma la intermedia y la final de ${autoNames} si esas fases están en Automático.`,
      );
    }
  } else if (phase === "intermediate") {
    affects.push(
      autoNames
        ? `Rearma la intermedia de ${autoNames}: día, horario y cancha.`
        : "No hay categorías en Modo Automático para rearmar.",
    );
    if (auto.length > 0) {
      affects.push(
        `También rearma la fase final de ${autoNames} si está en Automático.`,
      );
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
      `No toca ${manualNames}: ${manual.length === 1 ? "está" : "están"} en Modo Manual en esta pestaña.`,
    );
  }
  doesNotAffect.push("No borra los resultados ya cargados.");
  doesNotAffect.push("No cambia el modo de cada pestaña.");

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
