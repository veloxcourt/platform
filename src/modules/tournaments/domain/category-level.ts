const ORDINAL_BY_DIGIT: Record<string, string> = {
  "1": "1ra",
  "2": "2da",
  "3": "3ra",
  "4": "4ta",
  "5": "5ta",
  "6": "6ta",
  "7": "7ma",
  "8": "8va",
};

const CANONICAL_LEVELS = Object.values(ORDINAL_BY_DIGIT);

/// Normaliza un nivel suelto: "5ª" / "5?" / "5a" → "5ta".
export function normalizeCategoryLevel(value: string): string {
  const t = value
    .trim()
    .replace(/\uFFFD/g, "?")
    .replace(/[ªº]/g, "?");
  if (CANONICAL_LEVELS.includes(t)) return t;
  const m = t.match(/^([1-8])(?:\?|a|ra|da|ta|ma|va)?$/i);
  if (m) return ORDINAL_BY_DIGIT[m[1]]!;
  return value.trim();
}

/// Normaliza nombres compuestos: "Femenina 5?" → "Femenina 5ta".
export function normalizeCategoryLabel(name: string): string {
  return name
    .replace(/\uFFFD/g, "?")
    .replace(/[ªº]/g, "?")
    .replace(/([1-8])(?:\?|ra|da|ta|ma|va|a)?\??/gi, (_, digit: string) => {
      return ORDINAL_BY_DIGIT[digit] ?? digit;
    })
    .replace(/\s+/g, " ")
    .trim();
}

export const DEFAULT_CATEGORY_LEVELS = [...CANONICAL_LEVELS];
