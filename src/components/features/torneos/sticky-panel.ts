/** La tarjeta aísla el apilado para que las filas no tapen la barra. */
export const STICKY_PANEL_CARD =
  "relative isolate overflow-visible [&_[data-slot=card-content]]:relative [&_[data-slot=card-content]]:z-0";

/** Título y acciones: capa opaca que tapa el formulario al scrollear. */
export const STICKY_PANEL_HEADER =
  "relative sticky top-0 z-50 bg-background " +
  "before:pointer-events-none before:absolute before:-inset-x-(--card-spacing) before:-top-6 before:-bottom-2 before:z-0 before:bg-background " +
  "[&_[data-slot=card-title]]:relative [&_[data-slot=card-title]]:z-10 " +
  "[&_[data-slot=card-action]]:relative [&_[data-slot=card-action]]:z-10 [&_[data-slot=card-action]]:bg-background";
