import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

const LONG_PRESS_MS = 480;

export type MenuPoint = { x: number; y: number };

export type FieldMenuHoldRef = { current: number | null };

/// Clic derecho (mouse) o mantener pulsado (tablet) para abrir el mismo menú.
export function bindFieldMenuTrigger(
  enabled: boolean,
  open: (point: MenuPoint) => void,
  holdRef: FieldMenuHoldRef,
) {
  function clear() {
    if (holdRef.current != null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  }

  return {
    onContextMenu: (event: ReactMouseEvent) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      clear();
      open({ x: event.clientX, y: event.clientY });
    },
    onPointerDown: (event: ReactPointerEvent) => {
      if (!enabled || event.pointerType !== "touch") return;
      clear();
      const point = { x: event.clientX, y: event.clientY };
      holdRef.current = window.setTimeout(() => {
        holdRef.current = null;
        open(point);
      }, LONG_PRESS_MS);
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };
}
