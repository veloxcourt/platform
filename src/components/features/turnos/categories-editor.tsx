"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveCategoriesAction } from "@/app/(dashboard)/[clubSlug]/turnos/configuracion/actions";

export function CategoriesEditor({
  clubSlug,
  initialCategories,
}: {
  clubSlug: string;
  initialCategories: string[];
}) {
  const [items, setItems] = useState<string[]>(initialCategories);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function add() {
    const v = value.trim();
    if (!v) return;
    if (items.includes(v)) {
      toast.error("Esa categoría ya existe");
      return;
    }
    setItems((prev) => [...prev, v]);
    setValue("");
  }

  function remove(cat: string) {
    setItems((prev) => prev.filter((c) => c !== cat));
  }

  function save() {
    startTransition(async () => {
      const result = await saveCategoriesAction(clubSlug, items);
      if (result.ok) toast.success("Categorías guardadas");
      else toast.error("No se pudo guardar", { description: result.error });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorías de jugadores</CardTitle>
        <CardDescription>
          Estas categorías aparecen al dar de alta un jugador. Son propias de
          este club (ej. 1ra, 2da, 5ta).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin categorías.</p>
          )}
          {items.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-2.5 pr-1 text-sm"
            >
              {c}
              <button
                type="button"
                onClick={() => remove(c)}
                className="grid size-5 place-items-center rounded-full hover:bg-muted"
                aria-label={`Quitar ${c}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            className="max-w-xs"
            placeholder="Nueva categoría (ej. 5ta)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar categorías"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
