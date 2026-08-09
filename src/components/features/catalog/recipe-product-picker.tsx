"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { normalizeText } from "@/components/features/turnos/player-combobox";
import type {
  ProductListItem,
  ProductType,
} from "@/modules/catalog/domain/types";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const INPUT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/// Buscador de productos simples para armar la receta: filtro por tipo + texto.
export function RecipeProductPicker({
  products,
  types,
  excludeIds,
  onPick,
}: {
  products: ProductListItem[];
  types: ProductType[];
  excludeIds: string[];
  onPick: (productId: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    const exclude = new Set(excludeIds);
    return products.filter((p) => {
      if (exclude.has(p.id)) return false;
      if (typeFilter === "none" && p.typeId) return false;
      if (
        typeFilter !== "all" &&
        typeFilter !== "none" &&
        p.typeId !== typeFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        normalizeText(p.name).includes(q) ||
        normalizeText(p.code ?? "").includes(q) ||
        normalizeText(p.typeName ?? "").includes(q)
      );
    });
  }, [products, excludeIds, typeFilter, query]);

  return (
    <div className="space-y-2">
      <select
        className={SELECT_CLASS}
        aria-label="Filtrar por tipo de producto"
        value={typeFilter}
        onChange={(e) => {
          setTypeFilter(e.target.value);
          setOpen(true);
        }}
      >
        <option value="all">Todos los tipos</option>
        <option value="none">Sin tipo</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className={INPUT_CLASS}
          value={query}
          placeholder="Buscar producto por nombre o código..."
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
      </div>

      {open && (
        <div className="max-h-44 overflow-auto rounded-lg border bg-popover text-popover-foreground shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">
              Sin resultados
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(p.id);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "block w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                )}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {p.baseQuantity} {p.unit}
                  {p.typeName ? ` · ${p.typeName}` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
