/**
 * Abrevia un nombre completo a "I. Apellido…" (inicial del nombre + apellido/s).
 * Si solo hay una palabra, la deja igual.
 */
export function formatAbbreviatedPersonName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;

  const initial = parts[0]!.charAt(0).toLocaleUpperCase("es");
  const lastName = parts.slice(1).join(" ");
  return `${initial}. ${lastName}`;
}

/** Etiqueta corta de pareja: "S. Gómez / V. Ramírez". */
export function formatAbbreviatedPairLabel(
  player1Name: string,
  player2Name?: string | null,
): string {
  const p1 = formatAbbreviatedPersonName(player1Name);
  if (!player2Name) return p1;
  return `${p1} / ${formatAbbreviatedPersonName(player2Name)}`;
}
