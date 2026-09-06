"use client";

import { useEffect, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  exportCatalogAction,
  listExportableClubsAction,
  type ExportableClub,
} from "@/app/(dashboard)/[clubSlug]/catalogo/actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ExportCatalogButton({ clubSlug }: { clubSlug: string }) {
  const [open, setOpen] = useState(false);
  const [clubs, setClubs] = useState<ExportableClub[] | null>(null);
  const [destSlug, setDestSlug] = useState("");
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingClubs(true);
    listExportableClubsAction(clubSlug)
      .then((items) => {
        if (cancelled) return;
        setClubs(items);
        setDestSlug((current) =>
          current && items.some((club) => club.slug === current)
            ? current
            : (items[0]?.slug ?? ""),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setClubs([]);
        toast.error("No se pudieron cargar los clubes");
      })
      .finally(() => {
        if (!cancelled) setLoadingClubs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, clubSlug]);

  function submit() {
    if (!destSlug || pending) return;
    startTransition(async () => {
      const result = await exportCatalogAction(clubSlug, destSlug);
      if (!result.ok) {
        toast.error("No se pudo exportar", { description: result.error });
        return;
      }
      const parts = [
        `${result.productsCreated} producto${result.productsCreated === 1 ? "" : "s"} nuevo${result.productsCreated === 1 ? "" : "s"}`,
      ];
      if (result.productsSkipped > 0) {
        parts.push(
          `${result.productsSkipped} ya existían`,
        );
      }
      if (result.typesCreated > 0) {
        parts.push(
          `${result.typesCreated} tipo${result.typesCreated === 1 ? "" : "s"}`,
        );
      }
      toast.success(`Catálogo exportado a ${result.destName}`, {
        description: parts.join(" · "),
      });
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="size-4" />
        Exportar Catálogo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar catálogo</DialogTitle>
            <DialogDescription>
              Se copian tipos, productos, recetas y fotos al club destino. El
              stock no se transfiere. Si un producto ya existe (mismo nombre o
              código), se omite.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-catalog-club">Club destino</Label>
              {loadingClubs || clubs === null ? (
                <p className="text-sm text-muted-foreground">
                  Cargando clubes...
                </p>
              ) : clubs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tenés otros clubes con permiso para editar el catálogo.
                </p>
              ) : (
                <select
                  id="export-catalog-club"
                  className={SELECT_CLASS}
                  value={destSlug}
                  onChange={(e) => setDestSlug(e.target.value)}
                  disabled={pending}
                >
                  {clubs.map((club) => (
                    <option key={club.slug} value={club.slug}>
                      {club.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={pending || !destSlug || (clubs?.length ?? 0) === 0}
              >
                {pending ? "Exportando..." : "Exportar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
