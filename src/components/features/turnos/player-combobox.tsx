"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PlayerRef } from "@/modules/bookings/domain/types";

/// Normaliza texto para búsqueda: sin acentos, minúsculas.
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const INPUT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/// Selector de jugador con búsqueda por nombre/apellido.
export function PlayerCombobox({
  players,
  value,
  onChange,
  placeholder = "Buscar por nombre o apellido...",
  exclude,
}: {
  players: PlayerRef[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /// Ids de jugadores a ocultar del listado (ej. ya seleccionados en otros campos).
  exclude?: string[];
}) {
  const selected = players.find((p) => p.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = normalizeText(query);
  const available = exclude?.length
    ? players.filter((p) => !exclude.includes(p.id))
    : players;
  const filtered = q
    ? available.filter((p) => normalizeText(p.name).includes(q))
    : available;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        className={INPUT_CLASS}
        value={open ? query : (selected?.name ?? "")}
        placeholder={placeholder}
        onMouseDown={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
          {filtered.length === 0 ? (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">
              Sin resultados
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                // onMouseDown evita que el blur cierre el panel antes del click
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p.id);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "block w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                  p.id === value && "bg-muted font-medium",
                )}
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
