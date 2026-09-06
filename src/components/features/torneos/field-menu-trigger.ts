import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

const LONG_PRESS_MS = 2000;
const MOVE_CANCEL_PX = 12;

export type MenuPoint = { x: number; y: number };

export type FieldMenuHoldRef = {
  current: number | null;
  opened?: boolean;
  startX?: number;
  startY?: number;
};

export function consumedHoldClick(holdRef: FieldMenuHoldRef): boolean {
  if (!holdRef.opened) return false;
  holdRef.opened = false;
  return true;
}

/// Clic derecho (mouse) o mantener 2 s (tablet/celular) para abrir el mismo menú.
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
      holdRef.opened = false;
      open({ x: event.clientX, y: event.clientY });
    },
    onPointerDown: (event: ReactPointerEvent) => {
      if (!enabled || event.pointerType !== "touch") return;
      clear();
      holdRef.opened = false;
      holdRef.startX = event.clientX;
      holdRef.startY = event.clientY;
      const point = { x: event.clientX, y: event.clientY };
      holdRef.current = window.setTimeout(() => {
        holdRef.current = null;
        holdRef.opened = true;
        open(point);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event: ReactPointerEvent) => {
      if (holdRef.current == null) return;
      const dx = event.clientX - (holdRef.startX ?? event.clientX);
      const dy = event.clientY - (holdRef.startY ?? event.clientY);
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        clear();
      }
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };
}
