"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ZonePairOption } from "./zone-card";

export type ChangeZonePairOption = ZonePairOption & {
  zoneLabels: string[];
};

export function ChangeZonePairDialog({
  open,
  onOpenChange,
  zoneLabel,
  currentPairId,
  currentPairLabel,
  zonePairIds,
  options,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoneLabel: string;
  currentPairId: string;
  currentPairLabel: string;
  zonePairIds: string[];
  options: ChangeZonePairOption[];
  onSelect: (pairId: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
    return [...list].sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
    );
  }, [options, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar pareja</DialogTitle>
          <DialogDescription>
            Reemplazá {currentPairLabel} en {zoneLabel}. Elegí una pareja
            Parcial o Confirmado de la categoría.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pareja"
          aria-label="Buscar pareja"
          autoFocus
        />

        <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              No hay parejas que coincidan.
            </li>
          ) : (
            filtered.map((option) => {
              const isCurrent = option.id === currentPairId;
              const alreadyInZone =
                !isCurrent && zonePairIds.includes(option.id);
              const zoneText = option.zoneLabels.join(" · ");
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={isCurrent || alreadyInZone}
                    onClick={() => onSelect(option.id)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm",
                      isCurrent || alreadyInZone
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span className="min-w-0 font-medium break-words">
                      {option.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {isCurrent
                        ? "Actual"
                        : alreadyInZone
                          ? "Ya en esta zona"
                          : zoneText || "Sin zona"}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
