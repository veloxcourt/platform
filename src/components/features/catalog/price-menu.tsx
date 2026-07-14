"use client";

import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { normalizeText } from "@/components/features/turnos/player-combobox";
import type {
  ProductListItem,
  ProductType,
} from "@/modules/catalog/domain/types";

export function PriceMenu({
  currency,
  products,
  types,
}: {
  currency: string;
  products: ProductListItem[];
  types: ProductType[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return products.filter((p) => {
      if (typeFilter !== "all" && p.typeId !== typeFilter) return false;
      if (q && !normalizeText(p.name).includes(q)) return false;
      return true;
    });
  }, [products, query, typeFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar producto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
          Todos
        </Chip>
        {types.map((t) => (
          <Chip
            key={t.id}
            active={typeFilter === t.id}
            onClick={() => setTypeFilter(t.id)}
          >
            {t.name}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin productos.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex flex-col overflow-hidden rounded-lg border"
            >
              <div className="grid aspect-square place-items-center overflow-hidden bg-muted">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photoUrl}
                    alt={p.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <Package className="size-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2">
                <span className="line-clamp-2 text-sm font-medium leading-tight">
                  {p.name}
                </span>
                <span className="mt-auto text-base font-semibold">
                  {formatMoney(p.price, currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
      )}
    >
      {children}
    </button>
  );
}
