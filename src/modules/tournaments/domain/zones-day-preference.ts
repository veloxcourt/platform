import { z } from "zod";

/// Cómo prefiere la pareja repartir sus 2 partidos de fase de zonas.
export const ZONES_DAY_PREFERENCE_VALUES = [
  "SAME_DAY",
  "DIFFERENT_DAYS",
  "ANY",
] as const;

export type ZonesDayPreference = (typeof ZONES_DAY_PREFERENCE_VALUES)[number];

export const ZONES_DAY_PREFERENCE_LABELS: Record<ZonesDayPreference, string> = {
  SAME_DAY: "Jugar los dos partidos el mismo día",
  DIFFERENT_DAYS: "Jugar un partido en días diferentes",
  ANY: "Cualquier forma",
};

export const zonesDayPreferenceSchema = z.enum(ZONES_DAY_PREFERENCE_VALUES);

export const updatePairZonesDayPreferenceSchema = z.object({
  zonesDayPreference: zonesDayPreferenceSchema,
});

export type UpdatePairZonesDayPreferenceValues = z.infer<
  typeof updatePairZonesDayPreferenceSchema
>;

export function parseZonesDayPreference(
  value: string | null | undefined,
): ZonesDayPreference {
  if (
    value === "SAME_DAY" ||
    value === "DIFFERENT_DAYS" ||
    value === "ANY"
  ) {
    return value;
  }
  return "ANY";
}
