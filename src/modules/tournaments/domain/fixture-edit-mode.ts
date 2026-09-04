export const FIXTURE_EDIT_MODE_VALUES = ["AUTO", "MANUAL"] as const;

export type FixtureEditMode = (typeof FIXTURE_EDIT_MODE_VALUES)[number];

export const FIXTURE_EDIT_MODE_LABELS: Record<FixtureEditMode, string> = {
  AUTO: "Modo Automático",
  MANUAL: "Modo Manual",
};

export function parseFixtureEditMode(value: unknown): FixtureEditMode {
  return value === "MANUAL" ? "MANUAL" : "AUTO";
}
