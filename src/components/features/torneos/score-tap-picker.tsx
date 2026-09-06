"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { MatchFormat } from "@/modules/tournaments/domain/config-schema";
import {
  scoreChoicesForColumn,
  type ZoneResultColumn,
} from "@/modules/tournaments/domain/zone-bracket";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ScoreTapPicker({
  open,
  format,
  columns,
  scores,
  startKey,
  pair1Label,
  pair2Label,
  onChange,
  onClose,
}: {
  open: boolean;
  format: MatchFormat;
  columns: ZoneResultColumn[];
  scores: Record<string, string>;
  startKey: string;
  pair1Label: string;
  pair2Label: string;
  onChange: (key: string, value: string) => void;
  onClose: () => void;
}) {
  const [currentKey, setCurrentKey] = useState(startKey);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setCurrentKey(startKey);
  }, [open, startKey]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const html = document.documentElement;
    const { body } = document;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    dialog?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (dialog?.contains(event.target as Node)) return;
      event.preventDefault();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("touchmove", onTouchMove);
      restoreFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const column =
    columns.find((item) => item.key === currentKey) ?? columns[0];
  if (!column) return null;

  const choices = scoreChoicesForColumn(format, column.key);
  const pairLabel = column.label === "P2" ? pair2Label : pair1Label;
  const currentIndex = columns.findIndex((item) => item.key === column.key);

  function pick(value: string) {
    onChange(column.key, value);
    const next = columns[currentIndex + 1];
    if (next) {
      setCurrentKey(next.key);
      return;
    }
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center overscroll-none pt-[env(safe-area-inset-top)] sm:items-center sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Cerrar carga de resultado"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cargar resultado"
        tabIndex={-1}
        className="relative z-[101] w-full max-h-[calc(100dvh-env(safe-area-inset-top))] overflow-y-auto overscroll-contain rounded-t-2xl border bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-lg outline-none sm:max-h-[min(90dvh,calc(100dvh-2rem))] sm:max-w-sm sm:rounded-2xl"
      >
        <p className="text-xs text-muted-foreground">
          {column.group ?? "Set"} · {column.label}
        </p>
        <p className="text-base font-semibold leading-tight">{pairLabel}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {columns.map((item) => {
            const value = scores[item.key] ?? "";
            const active = item.key === column.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setCurrentKey(item.key)}
                className={cn(
                  "min-w-10 rounded-md border px-1.5 py-1 text-center tabular-nums",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                <span className="block text-[9px] leading-none opacity-80">
                  {item.group} {item.label}
                </span>
                <span className="text-sm font-semibold">{value || "–"}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {choices.map((value) => {
            const selected = scores[column.key] === String(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => pick(String(value))}
                className={cn(
                  "h-12 rounded-xl border text-lg font-semibold tabular-nums",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {value}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="h-10 flex-1 rounded-lg border border-border bg-background text-sm"
            onClick={() => onChange(column.key, "")}
          >
            Vaciar
          </button>
          <button
            type="button"
            className="h-10 flex-1 rounded-lg border border-primary bg-primary text-sm text-primary-foreground"
            onClick={onClose}
          >
            Listo
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Tocá un número; sigue solo al siguiente casillero
        </p>
      </div>
    </div>,
    document.body,
  );
}
