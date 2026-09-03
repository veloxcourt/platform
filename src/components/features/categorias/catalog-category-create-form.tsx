"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  nextPaletteColor,
  type CatalogCategory,
} from "@/modules/herramientas/domain/calendario-torneos";

export function CatalogCategoryCreateForm({
  existingCategories,
  submitLabel = "Agregar",
  pending = false,
  idPrefix = "cat",
  onCreate,
}: {
  existingCategories: CatalogCategory[];
  submitLabel?: string;
  pending?: boolean;
  idPrefix?: string;
  onCreate: (input: {
    name: string;
    abbreviation: string;
    color: string;
  }) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [color, setColor] = useState(() =>
    nextPaletteColor(existingCategories.map((c) => c.color)),
  );
  const [submitting, setSubmitting] = useState(false);
  const busy = pending || submitting;

  async function addCategory() {
    const trimmedName = name.trim();
    const trimmedAbbr = abbreviation.trim().toUpperCase();
    if (!trimmedName) {
      toast.error("Escribí el nombre de la categoría");
      return;
    }
    if (!trimmedAbbr) {
      toast.error("Escribí la abreviación");
      return;
    }
    if (
      existingCategories.some(
        (c) => c.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      toast.error("Ya existe una categoría con ese nombre");
      return;
    }
    if (
      existingCategories.some(
        (c) => c.abbreviation.toLowerCase() === trimmedAbbr.toLowerCase(),
      )
    ) {
      toast.error("Ya existe una categoría con esa abreviación");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onCreate({
        name: trimmedName,
        abbreviation: trimmedAbbr,
        color,
      });
      if (!ok) return;
      setName("");
      setAbbreviation("");
      setColor(
        nextPaletteColor([...existingCategories.map((c) => c.color), color]),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border p-3">
      <p className="mb-3 text-sm font-medium">Nueva categoría</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-name`}>Nombre</Label>
          <Input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Masculina 5ta"
            disabled={busy}
          />
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-abbr`}>Abreviación</Label>
          <Input
            id={`${idPrefix}-abbr`}
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            placeholder="M5"
            maxLength={6}
            disabled={busy}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-color`}>Color</Label>
          <Input
            id={`${idPrefix}-color`}
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-14 cursor-pointer p-1"
            disabled={busy}
          />
        </div>
        <Button type="button" onClick={() => void addCategory()} disabled={busy}>
          <Plus className="size-4" />
          {busy ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
