"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { CatalogCategoryCreateForm } from "@/components/features/categorias/catalog-category-create-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CatalogCategory } from "@/modules/herramientas/domain/calendario-torneos";
import type { TournamentCategoryItem } from "@/modules/tournaments/domain/types";
import {
  createCatalogAndAddCategoryAction,
  createCategoryAction,
  updateCatalogCategoryAction,
} from "@/app/(dashboard)/[clubSlug]/torneos/[tournamentId]/categorias/actions";

function isAlreadyInTournament(
  catalog: CatalogCategory,
  tournamentCategories: TournamentCategoryItem[],
) {
  return tournamentCategories.some(
    (category) =>
      category.catalogCategoryId === catalog.id ||
      category.name.toLowerCase() === catalog.name.toLowerCase(),
  );
}

export function AddCategoryDialog({
  clubSlug,
  tournamentId,
  catalogCategories,
  tournamentCategories,
  open,
  onOpenChange,
  onAdded,
}: {
  clubSlug: string;
  tournamentId: string;
  catalogCategories: CatalogCategory[];
  tournamentCategories: TournamentCategoryItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAbbreviation, setEditAbbreviation] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isPending, startTransition] = useTransition();

  const sortedCatalog = useMemo(
    () =>
      [...catalogCategories].sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
      ),
    [catalogCategories],
  );

  useEffect(() => {
    if (!open) {
      setShowCreate(false);
      setEditingId(null);
      return;
    }
    setShowCreate(catalogCategories.length === 0);
  }, [open, catalogCategories.length]);

  function startEdit(catalog: CatalogCategory) {
    setShowCreate(false);
    setEditingId(catalog.id);
    setEditName(catalog.name);
    setEditAbbreviation(catalog.abbreviation);
    setEditColor(catalog.color);
  }

  function addFromCatalog(catalog: CatalogCategory) {
    startTransition(async () => {
      const result = await createCategoryAction(clubSlug, tournamentId, {
        catalogCategoryId: catalog.id,
      });
      if (result.ok) {
        toast.success(`${catalog.name} agregada al torneo`);
        onOpenChange(false);
        onAdded();
      } else {
        toast.error("No se pudo agregar la categoría", {
          description: result.error,
        });
      }
    });
  }

  function saveEdit(catalog: CatalogCategory) {
    const trimmedName = editName.trim();
    const trimmedAbbr = editAbbreviation.trim().toUpperCase();
    if (!trimmedName) {
      toast.error("Escribí el nombre de la categoría");
      return;
    }
    if (!trimmedAbbr) {
      toast.error("Escribí la abreviación");
      return;
    }
    if (
      catalogCategories.some(
        (item) =>
          item.id !== catalog.id &&
          item.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      toast.error("Ya existe una categoría con ese nombre");
      return;
    }
    if (
      catalogCategories.some(
        (item) =>
          item.id !== catalog.id &&
          item.abbreviation.toLowerCase() === trimmedAbbr.toLowerCase(),
      )
    ) {
      toast.error("Ya existe una categoría con esa abreviación");
      return;
    }

    startTransition(async () => {
      const result = await updateCatalogCategoryAction(
        clubSlug,
        tournamentId,
        catalog.id,
        {
          name: trimmedName,
          abbreviation: trimmedAbbr,
          color: editColor,
        },
      );
      if (!result.ok) {
        toast.error("No se pudo actualizar la categoría", {
          description: result.error,
        });
        return;
      }
      toast.success("Categoría actualizada");
      setEditingId(null);
      onAdded();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar categoría</DialogTitle>
          <DialogDescription>
            Elegí una categoría del catálogo del club. Si no está, creala con el
            mismo formulario de Herramientas → Calendario.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {sortedCatalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay categorías en el catálogo.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {sortedCatalog.map((catalog) => {
                const alreadyIn = isAlreadyInTournament(
                  catalog,
                  tournamentCategories,
                );
                const editing = editingId === catalog.id;
                return (
                  <li
                    key={catalog.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                  >
                    {editing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 w-44"
                          placeholder="Nombre"
                          disabled={isPending}
                        />
                        <Input
                          value={editAbbreviation}
                          onChange={(e) => setEditAbbreviation(e.target.value)}
                          className="h-8 w-20"
                          placeholder="Abr."
                          maxLength={6}
                          disabled={isPending}
                        />
                        <Input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-8 w-14 cursor-pointer p-1"
                          disabled={isPending}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveEdit(catalog)}
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: catalog.color }}
                          />
                          <span className="truncate text-sm font-medium">
                            {catalog.name}
                          </span>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                            {catalog.abbreviation}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            disabled={isPending}
                            onClick={() => startEdit(catalog)}
                            title={`Editar ${catalog.name}`}
                            aria-label={`Editar ${catalog.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {alreadyIn ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              Ya está en el torneo
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => addFromCatalog(catalog)}
                            >
                              Agregar
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {showCreate ? (
            <CatalogCategoryCreateForm
              existingCategories={catalogCategories}
              submitLabel="Crear y agregar"
              pending={isPending}
              idPrefix="tournament-cat"
              onCreate={async (input) => {
                const result = await createCatalogAndAddCategoryAction(
                  clubSlug,
                  tournamentId,
                  input,
                );
                if (!result.ok) {
                  toast.error("No se pudo crear la categoría", {
                    description: result.error,
                  });
                  return false;
                }
                toast.success("Categoría creada y agregada al torneo");
                onOpenChange(false);
                onAdded();
                return true;
              }}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => {
                setEditingId(null);
                setShowCreate(true);
              }}
            >
              Nueva categoría
            </Button>
          )}

          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
