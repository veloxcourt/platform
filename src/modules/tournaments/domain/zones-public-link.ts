export const ZONES_DAYS_REQUIRED_TO_COPY_LINK =
  "No es posible copiar link, Asigná días a la fase de zonas en Configuración para poder marcar rangos de preferencia.";

/// El formulario público muestra el aviso de preferencias si alguna categoría
/// no tiene días en la fase de zonas. Sin categorías, ese aviso no aparece.
export function zonesCategoriesReadyForPublicLink(
  zonesPlayDatesByCategory: readonly (readonly string[])[],
): boolean {
  if (zonesPlayDatesByCategory.length === 0) return true;
  return zonesPlayDatesByCategory.every((dates) =>
    dates.some((date) => date.trim().length > 0),
  );
}
