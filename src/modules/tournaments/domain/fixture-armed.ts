import { parseZonesFixture } from "./zones-fixture-schema";

function hasPersistedFixture(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value !== "object") return false;
  // Zones: { zones: [...] }
  if ("zones" in value && Array.isArray((value as { zones: unknown }).zones)) {
    return (value as { zones: unknown[] }).zones.length > 0;
  }
  // Intermediate / final brackets usually have rounds or matches.
  if ("rounds" in value && Array.isArray((value as { rounds: unknown }).rounds)) {
    return (value as { rounds: unknown[] }).rounds.length > 0;
  }
  if ("matches" in value && Array.isArray((value as { matches: unknown }).matches)) {
    return (value as { matches: unknown[] }).matches.length > 0;
  }
  // Fallback: any non-empty object JSON counts as "armed".
  return Object.keys(value as object).length > 0;
}

/** True if the category already has zones / intermediate / final fixture. */
export function isCategoryFixtureArmed(settings: {
  zonesFixture: unknown;
  intermediateFixture: unknown;
  finalFixture: unknown;
} | null): boolean {
  if (!settings) return false;
  if (parseZonesFixture(settings.zonesFixture)?.zones.length) return true;
  if (hasPersistedFixture(settings.intermediateFixture)) return true;
  if (hasPersistedFixture(settings.finalFixture)) return true;
  return false;
}
